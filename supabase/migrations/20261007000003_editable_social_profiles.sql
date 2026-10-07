create or replace function public.get_my_social_profile()
returns table (id uuid, username text, bio text, avatar_url text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;

  return query
  select p.id, p.username, coalesce(p.bio, ''), p.avatar_url
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

create or replace function public.update_my_social_profile(
  p_username text,
  p_bio text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text := trim(coalesce(p_username, ''));
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if v_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'Der Benutzername muss 3 bis 20 Zeichen haben und darf nur Buchstaben, Zahlen und Unterstriche enthalten';
  end if;
  if char_length(coalesce(p_bio, '')) > 500 then raise exception 'Die Biografie darf höchstens 500 Zeichen haben'; end if;
  if p_avatar_url is not null and (char_length(p_avatar_url) > 1000 or p_avatar_url !~ '^https://') then
    raise exception 'Ungültige Bildadresse';
  end if;
  if exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(v_username)
      and p.id <> auth.uid()
  ) then
    raise exception 'Dieser Benutzername ist bereits vergeben';
  end if;

  update public.profiles
  set username = v_username,
      bio = coalesce(p_bio, ''),
      avatar_url = p_avatar_url
  where id = auth.uid();
  if not found then raise exception 'Profil nicht gefunden'; end if;
exception
  when unique_violation then
    raise exception 'Dieser Benutzername ist bereits vergeben';
end;
$$;

revoke all on function public.get_my_social_profile() from public;
revoke all on function public.update_my_social_profile(text, text) from public;
revoke all on function public.update_my_social_profile(text, text, text) from public;
grant execute on function public.get_my_social_profile() to authenticated;
grant execute on function public.update_my_social_profile(text, text, text) to authenticated;
