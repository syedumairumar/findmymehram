-- Every privileged function has a fixed search_path and explicit grants.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 60),
 age integer not null check(age between 18 and 100),
 city text not null check(length(city)<=100), profession text not null default '' check(length(profession)<=100),
 bio text not null default '' check(length(bio)<=1000), interests text[] not null default '{}', languages text[] not null default '{}',
 intention text not null default 'A serious relationship' check(length(intention)<=80),
 photo text not null default '', gender text not null default 'not specified' check(gender in ('man','woman','not specified')),
 status text not null default 'active' check(status in ('active','paused','suspended')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.accounts (id uuid primary key references auth.users(id) on delete cascade,birth_date date not null,terms_version text not null,created_at timestamptz not null default now());
create table public.memberships (user_id uuid primary key references auth.users(id) on delete cascade,tier text not null default 'free' check(tier in ('free','gold','diamond')),source text not null default 'free',expires_at timestamptz);
create table public.swipes (actor_id uuid references auth.users(id) on delete cascade,target_id uuid references auth.users(id) on delete cascade,liked boolean not null,created_at timestamptz not null default now(),primary key(actor_id,target_id),check(actor_id<>target_id));
create index swipes_incoming on public.swipes(target_id,liked,actor_id);
create index swipes_daily on public.swipes(actor_id,created_at);
create table public.matches (id uuid primary key default gen_random_uuid(),user_low uuid not null references auth.users(id) on delete cascade,user_high uuid not null references auth.users(id) on delete cascade,active boolean not null default true,created_at timestamptz not null default now(),unique(user_low,user_high),check(user_low<user_high));
create index matches_low on public.matches(user_low) where active;
create index matches_high on public.matches(user_high) where active;
create table public.messages (id uuid primary key default gen_random_uuid(),match_id uuid not null references public.matches(id) on delete cascade,sender_id uuid not null references auth.users(id) on delete cascade,content text not null check(length(content) between 1 and 2000),created_at timestamptz not null default now());
create index messages_page on public.messages(match_id,created_at desc,id);
create index messages_rate on public.messages(sender_id,created_at);
create table public.blocks (actor_id uuid references auth.users(id) on delete cascade,target_id uuid references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(actor_id,target_id),check(actor_id<>target_id));
create index blocks_target on public.blocks(target_id,actor_id);
create table public.reports (id uuid primary key default gen_random_uuid(),reporter_id uuid references auth.users(id) on delete set null,target_id uuid references auth.users(id) on delete set null,reason text not null check(length(reason) between 5 and 1000),status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now());
create table private.admin_roles (user_id uuid primary key references auth.users(id) on delete cascade,role text not null check(role in ('owner','moderator','billing','analyst')));
create table private.audit (id bigint generated always as identity primary key,actor_id uuid,action text not null,target_id uuid,created_at timestamptz not null default now());
create table public.subscriptions (id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,provider text not null check(provider in ('stripe','paypal')),provider_id text,environment text not null check(environment='sandbox'),tier text not null check(tier in ('gold','diamond')),status text not null default 'pending',paid_until timestamptz,created_at timestamptz not null default now(),unique(provider,provider_id));
create unique index one_pending_subscription on public.subscriptions(user_id) where status in ('pending','active');
create table public.payment_events (provider text not null,event_id text not null,environment text not null check(environment='sandbox'),processed_at timestamptz,created_at timestamptz not null default now(),primary key(provider,event_id));
create table public.payments (id text primary key,user_id uuid references auth.users(id) on delete set null,provider text not null,environment text not null check(environment='sandbox'),tier text not null,amount numeric not null default 0,status text not null,created_at timestamptz not null default now());
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;
alter table public.payments enable row level security;
revoke all on all tables in schema public from anon,authenticated;
revoke all on all tables in schema private from anon,authenticated;

create function private.active_user() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active') and
 (not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') or auth.jwt()->>'aal'='aal2');
$$;
create function private.no_block(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$ select not exists(select 1 from public.blocks where (actor_id=a and target_id=b) or(actor_id=b and target_id=a)); $$;
create function private.profile_json(p public.profiles) returns jsonb language sql stable set search_path='' as $$ select jsonb_build_object('id',p.id,'name',p.name,'age',p.age,'city',p.city,'profession',p.profession,'bio',p.bio,'interests',p.interests,'languages',p.languages,'intention',p.intention,'photo',p.photo,'gender',p.gender); $$;
create function public.can_admin() returns boolean language sql stable security definer set search_path='' as $$ select auth.jwt()->>'aal'='aal2' and exists(select 1 from private.admin_roles where user_id=auth.uid()) and private.active_user(); $$;
create function private.admin_access(allowed text[]) returns boolean language sql stable security definer set search_path='' as $$ select public.can_admin() and exists(select 1 from private.admin_roles where user_id=auth.uid() and (role='owner' or role=any(allowed))); $$;
create function public.has_admin_role() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.admin_roles where user_id=auth.uid()); $$;
create function public.my_profile() returns jsonb language sql stable security definer set search_path='' as $$ select private.profile_json(p) from public.profiles p where id=auth.uid() and (not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') or auth.jwt()->>'aal'='aal2'); $$;
create function public.my_membership() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce((select jsonb_build_object('tier',case when expires_at is null or expires_at>now() then tier else 'free' end,'source',source,'expires_at',expires_at) from public.memberships where user_id=auth.uid()),'{"tier":"free","source":"free","expires_at":null}'::jsonb); $$;

create function public.save_profile(details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare dob date; photo_path text; existing public.profiles; begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') and auth.jwt()->>'aal'<>'aal2' then raise exception 'Complete two-factor verification first'; end if;
 select * into existing from public.profiles where id=auth.uid();
 if existing.status='suspended' then raise exception 'Account suspended'; end if;
 if details->>'birth_date' is not null and details->>'birth_date'<>'' then dob=(details->>'birth_date')::date; else select birth_date into dob from private.accounts where id=auth.uid(); end if;
 if dob is null or dob>current_date-interval '18 years' or dob<current_date-interval '100 years' then raise exception 'This service is for adults aged 18 or older'; end if;
 if cardinality(array(select jsonb_array_elements_text(details->'interests')))>8 or cardinality(array(select jsonb_array_elements_text(details->'languages')))>6 then raise exception 'Too many profile tags'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(details->'interests','[]')) x where length(x)>60) or exists(select 1 from jsonb_array_elements_text(coalesce(details->'languages','[]')) x where length(x)>60) then raise exception 'Profile tags are too long'; end if;
 photo_path=coalesce(details->>'photo','');
 if photo_path<>'' and photo_path<>coalesce(existing.photo,'') and (split_part(photo_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=photo_path)) then raise exception 'Upload an authorized profile photo first'; end if;
 insert into private.accounts(id,birth_date,terms_version) values(auth.uid(),dob,'test-2026-10-30') on conflict(id) do update set birth_date=excluded.birth_date;
 insert into public.profiles(id,name,age,city,profession,bio,interests,languages,intention,photo,gender) values(auth.uid(),trim(details->>'name'),extract(year from age(dob)),trim(details->>'city'),coalesce(details->>'profession',''),coalesce(details->>'bio',''),array(select jsonb_array_elements_text(coalesce(details->'interests','[]'))),array(select jsonb_array_elements_text(coalesce(details->'languages','[]'))),coalesce(details->>'intention','A serious relationship'),photo_path,coalesce(details->>'gender','not specified'))
 on conflict(id) do update set name=excluded.name,age=excluded.age,city=excluded.city,profession=excluded.profession,bio=excluded.bio,interests=excluded.interests,languages=excluded.languages,intention=excluded.intention,photo=excluded.photo,gender=excluded.gender,updated_at=now();
 insert into public.memberships(user_id) values(auth.uid()) on conflict do nothing;
end $$;

create function public.discover_profiles(after_id uuid default null) returns setof jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not private.active_user() then raise exception 'Complete your profile and any two-factor verification first'; end if;
 return query select private.profile_json(p) from public.profiles p where p.id<>auth.uid() and p.status='active' and (after_id is null or p.id>after_id) and private.no_block(auth.uid(),p.id) and not exists(select 1 from public.swipes s where s.actor_id=auth.uid() and s.target_id=p.id) and not exists(select 1 from public.matches m where m.active and (m.user_low=least(auth.uid(),p.id) and m.user_high=greatest(auth.uid(),p.id))) order by p.id limit 30;
end $$;
create function public.record_swipe(target_id uuid,liked boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare found_match uuid; tier text; daily_limit int; begin
 if not private.active_user() or target_id=auth.uid() or not private.no_block(auth.uid(),target_id) or not exists(select 1 from public.profiles where id=target_id and status='active') then raise exception 'This profile is unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 tier=public.my_membership()->>'tier'; daily_limit=case tier when 'diamond' then 250 when 'gold' then 100 else 25 end;
 if liked and not exists(select 1 from public.swipes s where s.actor_id=auth.uid() and s.target_id=record_swipe.target_id and s.liked) and (select count(*) from public.swipes where actor_id=auth.uid() and swipes.liked and created_at>=date_trunc('day',now()))>=daily_limit then raise exception 'Daily like limit reached'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid(),target_id)::text||greatest(auth.uid(),target_id)::text,1));
 insert into public.swipes(actor_id,target_id,liked) values(auth.uid(),target_id,liked) on conflict on constraint swipes_pkey do update set liked=excluded.liked,created_at=case when excluded.liked and not swipes.liked then now() else swipes.created_at end;
 if liked and exists(select 1 from public.swipes s where s.actor_id=record_swipe.target_id and s.target_id=auth.uid() and s.liked) then
 insert into public.matches(user_low,user_high) values(least(auth.uid(),target_id),greatest(auth.uid(),target_id)) on conflict(user_low,user_high) do nothing;
 select id into found_match from public.matches where user_low=least(auth.uid(),target_id) and user_high=greatest(auth.uid(),target_id) and active;
 end if;
 return jsonb_build_object('matched',found_match is not null,'match_id',found_match);
end $$;
create function public.incoming_likes() returns jsonb language plpgsql stable security definer set search_path='' as $$ declare n int; rows jsonb; begin
 if not private.active_user() then raise exception 'Authentication and active profile required'; end if;
 select count(*) into n from public.swipes s join public.profiles p on p.id=s.actor_id where s.target_id=auth.uid() and s.liked and p.status='active' and private.no_block(auth.uid(),p.id) and not exists(select 1 from public.swipes own where own.actor_id=auth.uid() and own.target_id=p.id and own.liked);
 if public.my_membership()->>'tier'='free' then return jsonb_build_object('count',n,'profiles','[]'::jsonb); end if;
 select coalesce(jsonb_agg(private.profile_json(p)),'[]') into rows from (select p.* from public.swipes s join public.profiles p on p.id=s.actor_id where s.target_id=auth.uid() and s.liked and p.status='active' and private.no_block(auth.uid(),p.id) and not exists(select 1 from public.swipes own where own.actor_id=auth.uid() and own.target_id=p.id and own.liked) order by s.created_at desc limit 50) p;
 return jsonb_build_object('count',n,'profiles',rows);
end $$;
create function public.authorized_match(conversation_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.active_user() and exists(select 1 from public.matches m join public.profiles p on p.id=case when m.user_low=auth.uid() then m.user_high else m.user_low end where m.id=conversation_id and m.active and auth.uid() in (m.user_low,m.user_high) and p.status='active' and private.no_block(m.user_low,m.user_high)); $$;
create function public.my_matches() returns setof jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('id',m.id,'profile',private.profile_json(p),'last_message',(select content from public.messages where match_id=m.id order by created_at desc limit 1),'unread',0) from public.matches m join public.profiles p on p.id=case when m.user_low=auth.uid() then m.user_high else m.user_low end where public.authorized_match(m.id) order by m.created_at desc; $$;
grant select on public.messages,public.matches to authenticated;
create policy messages_read on public.messages for select to authenticated using(public.authorized_match(match_id));
create policy matches_read on public.matches for select to authenticated using(public.authorized_match(id));
create function public.send_message(conversation_id uuid,body text,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$ begin
 if not public.authorized_match(conversation_id) then raise exception 'An active mutual match is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2));
 if (select count(*) from public.messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Please slow down and try again shortly'; end if;
 insert into public.messages(id,match_id,sender_id,content) values(request_id,conversation_id,auth.uid(),trim(body)) on conflict(id) do nothing;
 return request_id;
end $$;
create function public.block_member(target_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or auth.uid()=target_id then raise exception 'Invalid block'; end if;
 insert into public.blocks(actor_id,target_id) values(auth.uid(),target_id) on conflict do nothing;
 update public.matches set active=false where user_low=least(auth.uid(),target_id) and user_high=greatest(auth.uid(),target_id);
end $$;
create function public.report_member(target_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.active_user() or target_id=auth.uid() then raise exception 'Invalid report'; end if;
 if (select count(*) from public.reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Report limit reached; please try again later'; end if;
 insert into public.reports(reporter_id,target_id,reason) values(auth.uid(),target_id,reason);
end $$;
create function public.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not private.active_user() then raise exception 'Active authenticated account required'; end if;
 return jsonb_build_object('profile',public.my_profile(),'account',(select to_jsonb(a) from private.accounts a where id=auth.uid()),'membership',public.my_membership(),'swipes',coalesce((select jsonb_agg(s) from public.swipes s where actor_id=auth.uid()),'[]'),'messages_sent',coalesce((select jsonb_agg(m) from public.messages m where sender_id=auth.uid()),'[]'),'subscriptions',coalesce((select jsonb_agg(s) from public.subscriptions s where user_id=auth.uid()),'[]'));
end $$;
create function public.admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
 if not private.admin_access(array['analyst','billing','moderator']) then raise exception 'Administrator role and verified 2FA are required'; end if;
 select jsonb_build_object('total',(select count(*) from public.profiles),'active',(select count(*) from public.profiles where status='active'),'reports',(select count(*) from public.reports where status='open'),'premium',(select count(*) from public.memberships where tier<>'free' and (expires_at is null or expires_at>now())),
 'users',coalesce((select jsonb_agg(private.profile_json(p)||jsonb_build_object('status',p.status,'tier',coalesce(m.tier,'free'),'joined',p.created_at)) from (select * from public.profiles order by created_at desc limit 100) p left join public.memberships m on m.user_id=p.id),'[]'),
 'daily',(select jsonb_agg(jsonb_build_object('day',to_char(d,'DD Mon'),'signups',(select count(*) from public.profiles where created_at>=d and created_at<d+interval '1 day'),'active',null) order by d) from generate_series(date_trunc('day',now())-interval '13 days',date_trunc('day',now()),interval '1 day') d),
 'payments',case when private.admin_access(array['billing']) then coalesce((select jsonb_agg(p) from (select * from public.payments order by created_at desc limit 100) p),'[]') else '[]'::jsonb end,
 'report_rows',case when private.admin_access(array['moderator']) then coalesce((select jsonb_agg(r) from (select id,reason,status,created_at,target_id from public.reports order by created_at desc limit 100) r),'[]') else '[]'::jsonb end) into result;
 insert into private.audit(actor_id,action) values(auth.uid(),'admin_overview_read'); return result;
end $$;
create function public.admin_action(target_id uuid,action text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.admin_access(array['moderator']) then raise exception 'Administrator role and verified 2FA required'; end if;
 if target_id=auth.uid() then raise exception 'Cannot moderate your own account'; end if;
 if action not in ('suspend','restore','resolve_report') then raise exception 'Unsupported action'; end if;
 if action='resolve_report' then update public.reports set status='resolved' where id=target_id; else update public.profiles set status=case action when 'suspend' then 'suspended' else 'active' end where id=target_id; end if;
 insert into private.audit(actor_id,action,target_id) values(auth.uid(),action,target_id);
end $$;
create function public.set_visibility(paused boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.active_user() and not exists(select 1 from public.profiles where id=auth.uid() and status='paused') then raise exception 'Account unavailable'; end if;
 if exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') and auth.jwt()->>'aal'<>'aal2' then raise exception 'Complete 2FA first'; end if;
 update public.profiles set status=case when paused then 'paused' else 'active' end where id=auth.uid() and status<>'suspended';
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',false,2097152,array['image/jpeg']) on conflict(id) do nothing;
-- Uploads require the trusted photo-upload function; browsers cannot bypass sanitation.
create policy profile_photo_read on storage.objects for select to authenticated using(bucket_id='profile-photos' and private.active_user() and exists(select 1 from public.profiles p where p.id::text=(storage.foldername(name))[1] and p.status='active' and private.no_block(auth.uid(),p.id)));

create policy signaling_receive on realtime.messages for select to authenticated using(extension='broadcast' and realtime.topic() ~ '^match:[0-9a-f-]{36}$' and public.authorized_match(split_part(realtime.topic(),':',2)::uuid));
create policy signaling_send on realtime.messages for insert to authenticated with check(extension='broadcast' and realtime.topic() ~ '^match:[0-9a-f-]{36}$' and public.authorized_match(split_part(realtime.topic(),':',2)::uuid));

revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function public.can_admin(), public.has_admin_role(), public.my_profile(),public.my_membership(),public.save_profile(jsonb),public.discover_profiles(uuid),public.record_swipe(uuid,boolean),public.incoming_likes(),public.authorized_match(uuid),public.my_matches(),public.send_message(uuid,text,uuid),public.block_member(uuid),public.report_member(uuid,text),public.export_my_data(),public.admin_overview(),public.admin_action(uuid,text),public.set_visibility(boolean) to authenticated;
-- Policy helpers require execution but private is not an API-exposed schema.
grant usage on schema private to authenticated;
grant execute on function private.active_user(),private.no_block(uuid,uuid) to authenticated;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;
grant usage on schema private to service_role;
grant all on all sequences in schema private to service_role;
alter publication supabase_realtime add table public.messages,public.matches;
