-- OAuth providers can create a Supabase user before the app has collected
-- its adult and terms attestations. Require those attestations on the first
-- profile save, and keep the pre-migration function unreachable by members.
alter function public.save_profile(jsonb) rename to save_profile_legacy;
revoke all on function public.save_profile_legacy(jsonb) from public, anon, authenticated;

create function public.save_profile(details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = auth.uid()
  ) and details->>'terms_accepted' is distinct from 'true' then
    raise exception 'Confirm that you are an adult and accept the test Terms and Privacy Notice';
  end if;

  perform public.save_profile_legacy(details);
end;
$$;

revoke all on function public.save_profile(jsonb) from public, anon, authenticated;
grant execute on function public.save_profile(jsonb) to authenticated;
