alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_distinct_users check (requester_id <> recipient_id),
  constraint friend_requests_unique_pair unique (requester_id, recipient_id)
);

create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists friend_requests_requester_status_idx
  on public.friend_requests (requester_id, status, created_at desc);

create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists global_chat_messages_created_at_idx
  on public.global_chat_messages (created_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint direct_messages_distinct_users check (sender_id <> recipient_id)
);
create index if not exists direct_messages_conversation_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_idx
  on public.direct_messages (recipient_id, sender_id, created_at desc);

alter table public.friend_requests enable row level security;
alter table public.global_chat_messages enable row level security;
alter table public.direct_messages enable row level security;
revoke all on public.friend_requests, public.global_chat_messages, public.direct_messages from anon, authenticated;

create or replace function public.search_public_profiles(p_query text)
returns table (id uuid, username text, bio text, avatar_url text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if trim(coalesce(p_query, '')) !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'Gib mindestens drei gültige Zeichen des Spielernamens ein';
  end if;
  return query
  select p.id, p.username, coalesce(p.bio, ''), p.avatar_url
  from public.profiles p
  where p.id <> auth.uid()
    and p.username ilike '%' || trim(p_query) || '%'
  order by p.username
  limit 20;
end;
$$;

create or replace function public.get_public_profile(p_username text)
returns table (id uuid, username text, bio text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, coalesce(p.bio, ''), p.avatar_url
  from public.profiles p
  where p.username = left(trim(p_username), 20)
  limit 1;
$$;

create or replace function public.update_my_social_profile(p_bio text, p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if char_length(coalesce(p_bio, '')) > 500 then raise exception 'Die Biografie darf höchstens 500 Zeichen haben'; end if;
  if p_avatar_url is not null and (char_length(p_avatar_url) > 1000 or p_avatar_url !~ '^https://') then
    raise exception 'Ungültige Bildadresse';
  end if;
  update public.profiles
  set bio = coalesce(p_bio, ''), avatar_url = p_avatar_url
  where id = auth.uid();
  if not found then raise exception 'Profil nicht gefunden'; end if;
end;
$$;

create or replace function public.request_friend(p_username text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid;
  v_request_id uuid;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  select p.id into v_target from public.profiles p where p.username = left(trim(p_username), 20);
  if v_target is null or v_target = auth.uid() then raise exception 'Spieler nicht gefunden'; end if;
  if exists (
    select 1 from public.friend_requests f
    where f.status in ('pending', 'accepted')
      and ((f.requester_id = auth.uid() and f.recipient_id = v_target)
        or (f.requester_id = v_target and f.recipient_id = auth.uid()))
  ) then raise exception 'Für diesen Spieler besteht bereits eine Anfrage oder Freundschaft'; end if;
  insert into public.friend_requests (requester_id, recipient_id, status)
  values (auth.uid(), v_target, 'pending')
  on conflict (requester_id, recipient_id)
  do update set status = 'pending', created_at = now(), responded_at = null
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_at = now()
  where id = p_request_id and recipient_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Freundschaftsanfrage nicht gefunden'; end if;
end;
$$;

create or replace function public.remove_friend(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  delete from public.friend_requests
  where status = 'accepted'
    and ((requester_id = auth.uid() and recipient_id = p_other_user_id)
      or (requester_id = p_other_user_id and recipient_id = auth.uid()));
end;
$$;

create or replace function public.get_my_friend_requests()
returns table (request_id uuid, user_id uuid, username text, avatar_url text, status text, direction text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.id, p.id, p.username, p.avatar_url, f.status,
    case when f.recipient_id = auth.uid() then 'incoming' else 'outgoing' end,
    f.created_at
  from public.friend_requests f
  join public.profiles p on p.id = case when f.recipient_id = auth.uid() then f.requester_id else f.recipient_id end
  where auth.uid() is not null
    and f.status = 'pending'
    and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
  order by f.created_at desc;
$$;

create or replace function public.get_my_friends()
returns table (id uuid, username text, bio text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, coalesce(p.bio, ''), p.avatar_url
  from public.friend_requests f
  join public.profiles p on p.id = case when f.requester_id = auth.uid() then f.recipient_id else f.requester_id end
  where auth.uid() is not null
    and f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
  order by p.username;
$$;

create or replace function public.get_global_chat_messages()
returns table (id uuid, sender_id uuid, username text, avatar_url text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.sender_id, p.username, p.avatar_url, m.body, m.created_at
  from (
    select g.id, g.sender_id, g.body, g.created_at
    from public.global_chat_messages g
    order by g.created_at desc
    limit 100
  ) m
  join public.profiles p on p.id = m.sender_id
  where auth.uid() is not null
  order by m.created_at;
$$;

create or replace function public.send_global_chat_message(p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'Nachrichten müssen 1 bis 500 Zeichen lang sein'; end if;
  if (select count(*) from public.global_chat_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 15 then
    raise exception 'Du hast gerade viele Nachrichten gesendet. Bitte warte kurz.';
  end if;
  insert into public.global_chat_messages(sender_id, body) values (auth.uid(), trim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.get_direct_messages(p_other_user_id uuid)
returns table (id uuid, sender_id uuid, username text, avatar_url text, body text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.recipient_id = p_other_user_id)
        or (f.requester_id = p_other_user_id and f.recipient_id = auth.uid()))
  ) then raise exception 'Private Nachrichten sind nur zwischen Freunden möglich'; end if;
  return query
  select m.id, m.sender_id, p.username, p.avatar_url, m.body, m.created_at
  from (
    select d.id, d.sender_id, d.body, d.created_at
    from public.direct_messages d
    where (d.sender_id = auth.uid() and d.recipient_id = p_other_user_id)
       or (d.sender_id = p_other_user_id and d.recipient_id = auth.uid())
    order by d.created_at desc
    limit 100
  ) m
  join public.profiles p on p.id = m.sender_id
  order by m.created_at;
end;
$$;

create or replace function public.send_direct_message(p_recipient_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_recipient_id = auth.uid() then raise exception 'Du kannst dir selbst keine Nachricht senden'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'Nachrichten müssen 1 bis 2.000 Zeichen lang sein'; end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.recipient_id = p_recipient_id)
        or (f.requester_id = p_recipient_id and f.recipient_id = auth.uid()))
  ) then raise exception 'Private Nachrichten sind nur zwischen Freunden möglich'; end if;
  if (select count(*) from public.direct_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Du hast gerade viele Nachrichten gesendet. Bitte warte kurz.';
  end if;
  insert into public.direct_messages(sender_id, recipient_id, body)
  values (auth.uid(), p_recipient_id, trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.search_public_profiles(text) from public;
revoke all on function public.get_public_profile(text) from public;
revoke all on function public.update_my_social_profile(text, text) from public;
revoke all on function public.request_friend(text) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.get_my_friend_requests() from public;
revoke all on function public.get_my_friends() from public;
revoke all on function public.get_global_chat_messages() from public;
revoke all on function public.send_global_chat_message(text) from public;
revoke all on function public.get_direct_messages(uuid) from public;
revoke all on function public.send_direct_message(uuid, text) from public;

grant execute on function public.search_public_profiles(text) to authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.update_my_social_profile(text, text) to authenticated;
grant execute on function public.request_friend(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_my_friend_requests() to authenticated;
grant execute on function public.get_my_friends() to authenticated;
grant execute on function public.get_global_chat_messages() to authenticated;
grant execute on function public.send_global_chat_message(text) to authenticated;
grant execute on function public.get_direct_messages(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public profile avatars are viewable" on storage.objects;
create policy "Public profile avatars are viewable"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');
drop policy if exists "Users upload their own profile avatars" on storage.objects;
create policy "Users upload their own profile avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update their own profile avatars" on storage.objects;
create policy "Users update their own profile avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete their own profile avatars" on storage.objects;
create policy "Users delete their own profile avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
