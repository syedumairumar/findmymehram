-- Sandbox only. Provider requests run in Edge Functions; state transitions and
-- event deduplication commit together. Clients cannot invoke service-only RPCs.
alter table public.subscriptions
 add column cancel_at_period_end boolean not null default false,
 add column checkout_id text,
 add column checkout_url text,
 add column reconcile_token uuid,
 add column reconcile_until timestamptz,
 add column reconciled_at timestamptz;
alter table public.subscriptions add constraint subscriptions_status_check
 check(status in('pending','active','past_due','cancelled','expired'));
drop index public.one_pending_subscription;
create unique index one_open_subscription on public.subscriptions(user_id)
 where status in('pending','active','past_due');
alter table public.payment_events drop constraint payment_events_pkey;
alter table public.payment_events add primary key(provider,environment,event_id);
alter table public.payment_events add column subscription_id uuid references public.subscriptions(id) on delete set null;
alter table public.payments add column currency text not null default 'GBP' check(currency='GBP');

create function public.reserve_checkout(chosen_provider text,chosen_tier text) returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare s public.subscriptions; begin
 if not private.active_user() then raise exception 'An active verified member profile is required'; end if;
 if chosen_provider not in('stripe','paypal') or chosen_tier not in('gold','diamond') then raise exception 'Invalid plan'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,41));
 -- Never expire an ambiguous checkout by wall-clock age: it may still charge.
 update public.subscriptions set status='cancelled' where user_id=auth.uid()
  and cancel_at_period_end and paid_until<=now() and status='active';
 select * into s from public.subscriptions where user_id=auth.uid()
  and (status in('pending','active','past_due') or (status='cancelled' and paid_until>now()))
  order by created_at desc limit 1 for update;
 if found then
  if s.status='pending' and s.provider=chosen_provider and s.tier=chosen_tier then return to_jsonb(s)-'reconcile_token'-'reconcile_until'; end if;
  raise exception 'An existing subscription must be reconciled or cancelled before starting another';
 end if;
 if (select count(*) from public.subscriptions where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Checkout limit reached; please try later'; end if;
 insert into public.subscriptions(user_id,provider,environment,tier,status)
 values(auth.uid(),chosen_provider,'sandbox',chosen_tier,'pending') returning * into s;
 return to_jsonb(s)-'reconcile_token'-'reconcile_until';
end $$;
create function public.my_billing() returns jsonb language plpgsql security definer set search_path='' as $$
 begin
 if not private.active_user() then raise exception 'An active verified member profile is required'; end if;
 return coalesce((select jsonb_build_object('id',s.id,'provider',s.provider,'tier',s.tier,'status',s.status,
 'paid_until',s.paid_until,'cancel_at_period_end',s.cancel_at_period_end,'environment',s.environment)
 from public.subscriptions s where user_id=auth.uid() order by created_at desc limit 1),'null'::jsonb);
end $$;

create function public.claim_billing_reconcile(subscription_ref uuid,event_provider text,event_ref text,lease_token uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare s public.subscriptions; e public.payment_events; begin
 if event_ref is null or lease_token is null or length(event_ref) not between 1 and 160 then raise exception 'Invalid event reference'; end if;
 select * into s from public.subscriptions where id=subscription_ref for update;
 if not found or s.provider<>event_provider or s.environment<>'sandbox' then raise exception 'Unknown checkout'; end if;
 select * into e from public.payment_events where provider=event_provider and environment='sandbox' and event_id=event_ref;
 if found and e.subscription_id is distinct from s.id then raise exception 'Event belongs to another checkout'; end if;
 if e.processed_at is not null then return jsonb_build_object('duplicate',true); end if;
 if s.reconcile_until>now() then raise exception 'Reconciliation in progress; retry later'; end if;
 insert into public.payment_events(provider,environment,event_id,subscription_id) values(event_provider,'sandbox',event_ref,s.id) on conflict do nothing;
 update public.subscriptions set reconcile_token=lease_token,reconcile_until=now()+interval '90 seconds' where id=s.id;
 return to_jsonb(s)||jsonb_build_object('duplicate',false);
end $$;

create function public.finish_billing_reconcile(subscription_ref uuid,event_ref text,lease_token uuid,
 provider_ref text,verified_status text,verified_until timestamptz,cancel_scheduled boolean,payment_rows jsonb) returns void
 language plpgsql security definer set search_path='' as $$
 declare s public.subscriptions; p jsonb; entitled boolean; begin
 select * into s from public.subscriptions where id=subscription_ref;
 if not found then raise exception 'Unknown checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.user_id::text,41));
 select * into s from public.subscriptions where id=subscription_ref for update;
 if s.reconcile_token is distinct from lease_token or s.reconcile_until<=now() then raise exception 'Reconciliation lease expired'; end if;
 if verified_status not in('pending','active','past_due','cancelled','expired') or verified_status is null then raise exception 'Invalid state'; end if;
 if provider_ref is null or length(provider_ref)>160 or (s.provider='stripe' and provider_ref !~ '^sub_[A-Za-z0-9]+$')
 or (s.provider='paypal' and provider_ref !~ '^I-[A-Z0-9]+$') then raise exception 'Invalid provider subscription'; end if;
 if s.provider_id is not null and s.provider_id<>provider_ref then raise exception 'Provider binding mismatch'; end if;
 if verified_until is not null and (verified_until>now()+interval '40 days' or verified_until<s.created_at-interval '40 days') then raise exception 'Invalid paid period'; end if;
 if payment_rows is null or jsonb_typeof(payment_rows)<>'array' or jsonb_array_length(payment_rows)>100 then raise exception 'Invalid payment rows'; end if;
 update public.subscriptions set provider_id=provider_ref,status=verified_status,paid_until=verified_until,
 cancel_at_period_end=cancel_scheduled,reconcile_token=null,reconcile_until=null,reconciled_at=now() where id=s.id;
 for p in select * from jsonb_array_elements(payment_rows) loop
  if p->>'currency' is null or p->>'status' is null or p->>'id' is null or p->>'amount' is null or p->>'currency'<>'GBP' or p->>'status' not in('paid','failed','refunded','disputed') or length(p->>'id') not between 1 and 160
  or (p->>'amount')::numeric<0 then raise exception 'Invalid payment'; end if;
  insert into public.payments(id,user_id,provider,environment,tier,amount,status,currency)
  values(s.provider||':'||(p->>'id'),s.user_id,s.provider,'sandbox',s.tier,(p->>'amount')::numeric,p->>'status','GBP')
  on conflict(id) do update set amount=excluded.amount,status=excluded.status;
 end loop;
 -- Historical cancellation cannot overwrite a newer subscription's membership.
 if not exists(select 1 from public.subscriptions where user_id=s.user_id and created_at>s.created_at) then
  entitled=verified_until>now() and verified_status in('active','past_due','cancelled');
  update public.memberships set tier=case when entitled then s.tier else 'free' end,
   source=case when entitled then s.provider else 'free' end,expires_at=case when entitled then verified_until else null end
   where user_id=s.user_id and source in('free','stripe','paypal');
 end if;
 update public.payment_events set processed_at=now() where provider=s.provider and environment='sandbox' and event_id=event_ref and subscription_id=s.id;
 if not found then raise exception 'Event receipt missing'; end if;
end $$;
create function public.release_billing_reconcile(subscription_ref uuid,lease_token uuid) returns void
 language sql security definer set search_path='' as $$
 update public.subscriptions set reconcile_token=null,reconcile_until=null where id=subscription_ref and reconcile_token=lease_token;
$$;
revoke all on public.subscriptions,public.payments,public.payment_events from public,anon,authenticated;
grant all on public.subscriptions,public.payments,public.payment_events to service_role;
revoke all on function public.reserve_checkout(text,text),public.my_billing() from public,anon;
grant execute on function public.reserve_checkout(text,text),public.my_billing() to authenticated;
revoke all on function public.claim_billing_reconcile(uuid,text,text,uuid),public.finish_billing_reconcile(uuid,text,uuid,text,text,timestamptz,boolean,jsonb),public.release_billing_reconcile(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_billing_reconcile(uuid,text,text,uuid),public.finish_billing_reconcile(uuid,text,uuid,text,text,timestamptz,boolean,jsonb),public.release_billing_reconcile(uuid,uuid) to service_role;
