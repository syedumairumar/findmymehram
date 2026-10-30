-- Operators do not need to publish a dating profile or supply a member DOB.
-- A suspended operator profile still revokes access; verified TOTP is mandatory.
create or replace function public.can_admin() returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.jwt()->>'aal'='aal2'
 and exists(select 1 from private.admin_roles where user_id=auth.uid())
 and not exists(select 1 from public.profiles where id=auth.uid() and status='suspended');
$$;
revoke all on function public.can_admin() from public,anon;
grant execute on function public.can_admin() to authenticated;
