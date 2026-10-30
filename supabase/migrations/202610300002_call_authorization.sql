-- Durable signaling is authorized per operation, so a previously joined
-- Realtime channel cannot continue signaling after a block or suspension.
create index profiles_joined on public.profiles(created_at);
create index reports_rate on public.reports(reporter_id,created_at);

create table public.calls (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null references public.matches(id) on delete cascade,
 caller_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 video boolean not null,
 status text not null default 'ringing' check(status in ('ringing','accepted','ended')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 accepted_at timestamptz,
 ended_at timestamptz,
 check(caller_id<>receiver_id)
);
create index calls_receiver on public.calls(receiver_id,status,created_at desc);
create index calls_caller on public.calls(caller_id,created_at desc);
create index calls_expiry on public.calls(expires_at);
create table public.call_signals (
 id bigint generated always as identity primary key,
 call_id uuid not null references public.calls(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('offer','answer','candidate')),
 payload jsonb not null check(pg_column_size(payload)<=24576),
 created_at timestamptz not null default now()
);
create index call_signal_cursor on public.call_signals(call_id,id);
alter table public.calls enable row level security;
alter table public.call_signals enable row level security;
revoke all on public.calls,public.call_signals from public,anon,authenticated;
grant select on public.calls,public.call_signals to authenticated;
grant all on public.calls,public.call_signals to service_role;
grant usage,select on sequence public.call_signals_id_seq to service_role;

create function public.authorized_call(call_ref uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.calls c where c.id=call_ref
 and auth.uid() in(c.caller_id,c.receiver_id)
 and c.status in('ringing','accepted') and c.expires_at>now()
 and (c.status='accepted' or c.created_at>now()-interval '45 seconds')
 and public.authorized_match(c.match_id));
$$;
create policy call_read on public.calls for select to authenticated
 using(auth.uid() in(caller_id,receiver_id) and public.authorized_match(match_id)
 and created_at>now()-interval '1 hour');
create policy signal_read on public.call_signals for select to authenticated
 using(public.authorized_call(call_id));

create function public.start_call(conversation_id uuid,wants_video boolean) returns public.calls
 language plpgsql security definer set search_path='' as $$
 declare result public.calls; receiver uuid; lock_id uuid; begin
 if not public.authorized_match(conversation_id) then raise exception 'An active mutual match is required'; end if;
 select case when user_low=auth.uid() then user_high else user_low end into receiver from public.matches where id=conversation_id;
 -- Consistent participant lock order prevents simultaneous/cross-match calls.
 for lock_id in select unnest(array[auth.uid(),receiver]) order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended(lock_id::text,31));
 end loop;
 if exists(select 1 from public.calls where status in('ringing','accepted') and expires_at>now()
 and (status='accepted' or created_at>now()-interval '45 seconds')
 and (caller_id in(auth.uid(),receiver) or receiver_id in(auth.uid(),receiver))) then raise exception 'One of you is already in a call'; end if;
 if (select count(*) from public.calls where caller_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Call invitation limit reached; try again later'; end if;
 insert into public.calls(match_id,caller_id,receiver_id,video) values(conversation_id,auth.uid(),receiver,wants_video) returning * into result;
 return result;
end $$;
create function public.answer_call(call_ref uuid) returns void
 language plpgsql security definer set search_path='' as $$ begin
 if not public.authorized_call(call_ref) then raise exception 'Call unavailable'; end if;
 update public.calls set status='accepted',accepted_at=now() where id=call_ref and receiver_id=auth.uid() and status='ringing';
 if not found then raise exception 'Only the recipient can accept a ringing call'; end if;
end $$;
create function public.end_call(call_ref uuid) returns void
 language plpgsql security definer set search_path='' as $$ begin
 -- Either participant can hang up even after blocking; no active-match access is restored.
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 update public.calls set status='ended',ended_at=coalesce(ended_at,now())
 where id=call_ref and auth.uid() in(caller_id,receiver_id);
 if not found then raise exception 'Call unavailable'; end if;
 delete from public.call_signals where call_id=call_ref;
end $$;
create function public.send_call_signal(call_ref uuid,signal_kind text,signal_payload jsonb) returns void
 language plpgsql security definer set search_path='' as $$
 declare c public.calls; begin
 if not public.authorized_call(call_ref) then raise exception 'Call unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(call_ref::text,32));
 select * into c from public.calls where id=call_ref;
 if signal_kind is null or signal_kind not in('offer','answer','candidate') or signal_payload is null or jsonb_typeof(signal_payload)<>'object' or octet_length(signal_payload::text)>24576 then raise exception 'Invalid signal'; end if;
 if c.status<>'accepted' then raise exception 'The recipient must accept before media negotiation'; end if;
 if signal_kind='offer' and (c.caller_id<>auth.uid() or coalesce(signal_payload->>'type','')<>'offer') then raise exception 'Invalid offer'; end if;
 if signal_kind='answer' and (c.receiver_id<>auth.uid() or coalesce(signal_payload->>'type','')<>'answer') then raise exception 'Invalid answer'; end if;
 if signal_kind in('offer','answer') and (length(coalesce(signal_payload->>'sdp','')) not between 1 and 20000
 or exists(select 1 from public.call_signals where call_id=call_ref and kind=signal_kind)) then raise exception 'Invalid or duplicate session description'; end if;
 if signal_kind='candidate' and (length(coalesce(signal_payload->>'candidate','')) not between 1 and 2000
 or coalesce(signal_payload->>'candidate','') !~ ' typ relay( |$)') then raise exception 'Only relay candidates are permitted'; end if;
 if (select count(*) from public.call_signals where call_id=call_ref and sender_id=auth.uid())>=100 then raise exception 'Signal limit reached'; end if;
 insert into public.call_signals(call_id,sender_id,kind,payload) values(call_ref,auth.uid(),signal_kind,signal_payload);
end $$;

-- A TURN credential can be requested once per participant per call. The provider
-- master key never leaves the Edge Function. Each grant is serialized and audited.
create table private.call_relay_grants (
 call_id uuid references public.calls(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(call_id,user_id)
);
revoke all on private.call_relay_grants from public,anon,authenticated;
grant all on private.call_relay_grants to service_role;
create function public.claim_call_relay(call_ref uuid) returns boolean
 language plpgsql security definer set search_path='' as $$ begin
 if not public.authorized_call(call_ref) or not exists(select 1 from public.calls where id=call_ref and status='accepted') then raise exception 'Accepted call required'; end if;
 insert into private.call_relay_grants(call_id,user_id) values(call_ref,auth.uid()) on conflict do nothing;
 return found;
end $$;

-- On a new call, prune old signaling for this match without an external cron.
create function private.prune_call_signals() returns trigger
 language plpgsql security definer set search_path='' as $$ begin
 delete from public.call_signals where call_id in(select id from public.calls where match_id=new.match_id and expires_at<now());
 return new;
end $$;
create trigger prune_call_signals after insert on public.calls for each row execute function private.prune_call_signals();
revoke all on function private.prune_call_signals() from public,anon,authenticated;
revoke all on function public.authorized_call(uuid),public.start_call(uuid,boolean),public.answer_call(uuid),public.end_call(uuid),public.send_call_signal(uuid,text,jsonb),public.claim_call_relay(uuid) from public,anon,authenticated;
grant execute on function public.authorized_call(uuid),public.start_call(uuid,boolean),public.answer_call(uuid),public.end_call(uuid),public.send_call_signal(uuid,text,jsonb),public.claim_call_relay(uuid) to authenticated;
alter publication supabase_realtime add table public.calls,public.call_signals;

-- Signaling is transient, not message history. Remove it within ten minutes of
-- expiry even when neither participant returns; retain call metadata one day.
create extension if not exists pg_cron;
select cron.schedule('findmymehram-call-retention','*/10 * * * *',
 $$delete from public.call_signals where call_id in(select id from public.calls where expires_at<now());
 delete from public.calls where created_at<now()-interval '1 day';$$);
