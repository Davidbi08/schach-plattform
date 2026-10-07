create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;

create table if not exists public.chess_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  challenged_id uuid not null references auth.users(id) on delete cascade,
  initial_seconds integer not null check (initial_seconds between 60 and 3600),
  increment_seconds integer not null check (increment_seconds between 0 and 60),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint chess_challenges_distinct_users check (challenger_id <> challenged_id)
);

create index if not exists chess_challenges_receiver_status_idx
  on public.chess_challenges (challenged_id, status, created_at desc);
create index if not exists chess_challenges_sender_status_idx
  on public.chess_challenges (challenger_id, status, created_at desc);
alter table public.chess_challenges enable row level security;
revoke all on public.chess_challenges from public, anon, authenticated;

create or replace function public.create_chess_challenge(
  p_target_user_id uuid,
  p_initial_seconds integer,
  p_increment_seconds integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if exists (select 1 from public.community_suspensions s where s.user_id = auth.uid() and (s.expires_at is null or s.expires_at > now())) then
    raise exception using errcode = '42501', message = 'Du kannst mit einer aktiven Community-Sperre keine Herausforderung senden';
  end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then raise exception 'Ungültiger Gegner'; end if;
  if p_initial_seconds not between 60 and 3600 or p_increment_seconds not between 0 and 60 then
    raise exception 'Ungültige Bedenkzeit';
  end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_target_user_id)
       or (b.blocker_id = p_target_user_id and b.blocked_id = auth.uid())
  ) then raise exception 'Für diesen Spieler besteht eine Blockierung'; end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.recipient_id = p_target_user_id)
        or (f.requester_id = p_target_user_id and f.recipient_id = auth.uid()))
  ) then raise exception 'Du kannst nur bestätigte Freunde herausfordern'; end if;
  if exists (
    select 1 from public.chess_challenges c
    where c.status = 'pending'
      and ((c.challenger_id = auth.uid() and c.challenged_id = p_target_user_id)
        or (c.challenger_id = p_target_user_id and c.challenged_id = auth.uid()))
  ) then raise exception 'Für diesen Freund gibt es bereits eine offene Herausforderung'; end if;

  insert into public.chess_challenges(challenger_id, challenged_id, initial_seconds, increment_seconds)
  values (auth.uid(), p_target_user_id, p_initial_seconds, p_increment_seconds)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.list_my_chess_challenges()
returns table (
  challenge_id uuid,
  challenger_id uuid,
  challenged_id uuid,
  challenger_username text,
  challenged_username text,
  initial_seconds integer,
  increment_seconds integer,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c.id, c.challenger_id, c.challenged_id, challenger.username, challenged.username,
    c.initial_seconds, c.increment_seconds, c.status, c.created_at
  from public.chess_challenges c
  join public.profiles challenger on challenger.id = c.challenger_id
  join public.profiles challenged on challenged.id = c.challenged_id
  where auth.uid() in (c.challenger_id, c.challenged_id)
    and c.status in ('pending', 'accepted')
  order by c.created_at desc
  limit 30;
$$;

create or replace function public.respond_chess_challenge(p_challenge_id uuid, p_accept boolean)
returns table (
  challenge_id uuid,
  challenger_id uuid,
  challenged_id uuid,
  challenger_username text,
  challenged_username text,
  initial_seconds integer,
  increment_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if p_accept is null then raise exception 'Ungültige Antwort auf die Herausforderung'; end if;
  if p_accept then
    if exists (select 1 from public.community_suspensions s where s.user_id = auth.uid() and (s.expires_at is null or s.expires_at > now())) then
      raise exception using errcode = '42501', message = 'Du kannst mit einer aktiven Community-Sperre keine Herausforderung annehmen';
    end if;
    if exists (
      select 1 from public.chess_challenges c join public.user_blocks b
        on (b.blocker_id = c.challenger_id and b.blocked_id = c.challenged_id)
        or (b.blocker_id = c.challenged_id and b.blocked_id = c.challenger_id)
      where c.id = p_challenge_id
    ) or not exists (
      select 1 from public.chess_challenges c
      join public.friend_requests f on f.status = 'accepted'
        and ((f.requester_id = c.challenger_id and f.recipient_id = c.challenged_id)
          or (f.requester_id = c.challenged_id and f.recipient_id = c.challenger_id))
      where c.id = p_challenge_id
    ) then
      raise exception 'Diese Herausforderung ist wegen einer Blockierung oder fehlenden Freundschaft nicht mehr verfügbar';
    end if;
    update public.chess_challenges c
    set status = 'accepted', responded_at = now()
    where c.id = p_challenge_id and c.challenged_id = auth.uid() and c.status = 'pending';
    if not found then raise exception 'Offene Herausforderung nicht gefunden'; end if;

    return query
    select c.id, c.challenger_id, c.challenged_id, challenger.username, challenged.username,
      c.initial_seconds, c.increment_seconds
    from public.chess_challenges c
    join public.profiles challenger on challenger.id = c.challenger_id
    join public.profiles challenged on challenged.id = c.challenged_id
    where c.id = p_challenge_id;
  else
    update public.chess_challenges c
    set status = 'declined', responded_at = now()
    where c.id = p_challenge_id and c.challenged_id = auth.uid() and c.status = 'pending';
    if not found then raise exception 'Offene Herausforderung nicht gefunden'; end if;
  end if;
end;
$$;

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'Du kannst dieses Konto nicht blockieren'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'Nutzer nicht gefunden'; end if;

  insert into public.user_blocks(blocker_id, blocked_id)
  values (auth.uid(), p_user_id)
  on conflict do nothing;
  delete from public.friend_requests f
  where (f.requester_id = auth.uid() and f.recipient_id = p_user_id)
     or (f.requester_id = p_user_id and f.recipient_id = auth.uid());
  delete from public.chess_challenges c
  where (c.challenger_id = auth.uid() and c.challenged_id = p_user_id)
     or (c.challenger_id = p_user_id and c.challenged_id = auth.uid());
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
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
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  select p.id into v_target from public.profiles p where p.username = left(trim(p_username), 20);
  if v_target is null or v_target = auth.uid() then raise exception 'Spieler nicht gefunden'; end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = v_target)
       or (b.blocker_id = v_target and b.blocked_id = auth.uid())
  ) then raise exception 'Für diesen Spieler besteht eine Blockierung'; end if;
  if exists (
    select 1 from public.friend_requests f
    where f.status in ('pending', 'accepted')
      and ((f.requester_id = auth.uid() and f.recipient_id = v_target)
        or (f.requester_id = v_target and f.recipient_id = auth.uid()))
  ) then raise exception 'Für diesen Spieler besteht bereits eine Anfrage oder Freundschaft'; end if;
  insert into public.friend_requests(requester_id, recipient_id, status)
  values (auth.uid(), v_target, 'pending')
  on conflict (requester_id, recipient_id)
  do update set status = 'pending', created_at = now(), responded_at = null
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.list_my_blocked_users()
returns table (user_id uuid, username text, created_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select b.blocked_id, p.username, b.created_at
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
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
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by p.username;
$$;

create or replace function public.get_direct_messages(p_other_user_id uuid)
returns table (id uuid, sender_id uuid, username text, avatar_url text, body text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other_user_id)
       or (b.blocker_id = p_other_user_id and b.blocked_id = auth.uid())
  ) then raise exception 'Private Nachrichten sind für diese Konten nicht verfügbar'; end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.recipient_id = p_other_user_id)
        or (f.requester_id = p_other_user_id and f.recipient_id = auth.uid()))
  ) then raise exception 'Private Nachrichten sind nur zwischen Freunden möglich'; end if;

  return query
  select m.id, m.sender_id, p.username, p.avatar_url,
    public.censor_chat_profanity(m.body), m.created_at
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
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if p_recipient_id = auth.uid() then raise exception 'Du kannst dir selbst keine Nachricht senden'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'Nachrichten müssen 1 bis 2.000 Zeichen lang sein'; end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_recipient_id)
       or (b.blocker_id = p_recipient_id and b.blocked_id = auth.uid())
  ) then raise exception 'Private Nachrichten sind für diese Konten nicht verfügbar'; end if;
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
  values (auth.uid(), p_recipient_id, public.censor_chat_profanity(trim(p_body)))
  returning id into v_id;
  return v_id;
end;
$$;

create table if not exists public.online_game_archive (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (char_length(game_id) between 1 and 200),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  saved_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.online_game_archive enable row level security;
revoke all on public.online_game_archive from public, anon, authenticated;

create or replace function public.save_my_online_game(p_record jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_game_id text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Ungültiger Partieeintrag';
  end if;
  if jsonb_typeof(p_record->'moves') is distinct from 'array' then raise exception 'Ungültige Zugfolge'; end if;
  if jsonb_array_length(p_record->'moves') > 500
    or p_record->>'result' is null
    or p_record->>'result' not in ('win', 'loss', 'draw')
    or length(coalesce(p_record->>'timeControl', '')) > 20
    or length(coalesce(p_record->>'reason', '')) > 200 then
    raise exception 'Ungültiger Partieeintrag';
  end if;
  v_game_id := p_record->>'id';
  if v_game_id is null or char_length(v_game_id) not between 1 and 200 then raise exception 'Ungültige Partie-ID'; end if;
  if char_length(coalesce(p_record->>'playedAt', '')) > 40 then raise exception 'Ungültiges Partiedatum'; end if;

  insert into public.online_game_archive(user_id, game_id, record)
  values (auth.uid(), v_game_id, p_record)
  on conflict (user_id, game_id) do update set record = excluded.record, saved_at = now();
end;
$$;

create or replace function public.list_my_online_games()
returns table (record jsonb)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select a.record
  from public.online_game_archive a
  where a.user_id = auth.uid()
  order by a.saved_at desc
  limit 100;
$$;

revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.list_my_blocked_users() from public, anon;
revoke all on function public.request_friend(text) from public, anon;
revoke all on function public.create_chess_challenge(uuid, integer, integer) from public, anon;
revoke all on function public.list_my_chess_challenges() from public, anon;
revoke all on function public.respond_chess_challenge(uuid, boolean) from public, anon;
revoke all on function public.get_my_friends() from public, anon;
revoke all on function public.get_direct_messages(uuid) from public, anon;
revoke all on function public.send_direct_message(uuid, text) from public, anon;
revoke all on function public.save_my_online_game(jsonb) from public, anon;
revoke all on function public.list_my_online_games() from public, anon;

grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.list_my_blocked_users() to authenticated;
grant execute on function public.request_friend(text) to authenticated;
grant execute on function public.create_chess_challenge(uuid, integer, integer) to authenticated;
grant execute on function public.list_my_chess_challenges() to authenticated;
grant execute on function public.respond_chess_challenge(uuid, boolean) to authenticated;
grant execute on function public.get_my_friends() to authenticated;
grant execute on function public.get_direct_messages(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.save_my_online_game(jsonb) to authenticated;
grant execute on function public.list_my_online_games() to authenticated;

create or replace function public.support_reply(p_ticket_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
  v_is_admin boolean;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if char_length(trim(coalesce(p_message, ''))) not between 1 and 5000 then
    raise exception 'Die Nachricht muss zwischen 1 und 5000 Zeichen lang sein';
  end if;

  v_is_admin := public.is_site_admin(array['owner', 'admin']);
  select * into v_ticket
  from public.support_tickets t
  where t.id = p_ticket_id and (t.user_id = v_actor or v_is_admin)
  for update;
  if not found then raise exception 'Supportanfrage nicht gefunden'; end if;

  insert into public.support_ticket_messages(ticket_id, sender_id, body)
  values (v_ticket.id, v_actor, trim(p_message));
  update public.support_tickets
  set updated_at = now(), status = case when v_is_admin then 'in_progress' else 'open' end
  where id = v_ticket.id;

  if v_is_admin then
    insert into public.admin_audit_log(actor_id, action, target_user_id, details)
    values (v_actor, 'support_reply_sent', v_ticket.user_id, jsonb_build_object('ticket_id', v_ticket.id));
    insert into public.admin_notifications(user_id, created_by, title, body)
    values (v_ticket.user_id, v_actor, 'Neue Antwort vom Support', left(trim(p_message), 2000));
  end if;
end;
$$;

notify pgrst, 'reload schema';
