create table if not exists public.chess_tournaments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  initial_seconds integer not null check (initial_seconds between 60 and 3600),
  increment_seconds integer not null check (increment_seconds between 0 and 60),
  max_players integer not null default 8 check (max_players between 2 and 16),
  status text not null default 'open' check (status in ('open', 'running', 'completed')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists chess_tournaments_status_created_idx
  on public.chess_tournaments (status, created_at desc);

create table if not exists public.chess_tournament_players (
  tournament_id uuid not null references public.chess_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score numeric(5,1) not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create index if not exists chess_tournament_players_user_idx
  on public.chess_tournament_players (user_id, joined_at desc);

create table if not exists public.chess_tournament_games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.chess_tournaments(id) on delete cascade,
  white_user_id uuid not null references auth.users(id) on delete cascade,
  black_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'disputed', 'finished')),
  white_report text check (white_report in ('white', 'black', 'draw')),
  black_report text check (black_report in ('white', 'black', 'draw')),
  result text check (result in ('white', 'black', 'draw')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint chess_tournament_game_distinct_players check (white_user_id <> black_user_id),
  constraint chess_tournament_game_unique_pair unique (tournament_id, white_user_id, black_user_id)
);

create index if not exists chess_tournament_games_tournament_idx
  on public.chess_tournament_games (tournament_id, status, created_at);

alter table public.chess_tournaments enable row level security;
alter table public.chess_tournament_players enable row level security;
alter table public.chess_tournament_games enable row level security;
revoke all on public.chess_tournaments, public.chess_tournament_players,
  public.chess_tournament_games from public, anon, authenticated;

create or replace function public.create_chess_tournament(
  p_name text,
  p_initial_seconds integer,
  p_increment_seconds integer,
  p_max_players integer default 8
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
    raise exception using errcode = '42501', message = 'Du kannst mit einer aktiven Community-Sperre kein Turnier erstellen';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 80 then
    raise exception 'Der Turniername muss 3 bis 80 Zeichen lang sein';
  end if;
  if p_initial_seconds not between 60 and 3600 or p_increment_seconds not between 0 and 60 then
    raise exception 'Ungültige Bedenkzeit';
  end if;
  if p_max_players not between 2 and 16 then
    raise exception 'Ein Turnier braucht Platz für 2 bis 16 Spieler';
  end if;

  insert into public.chess_tournaments(creator_id, name, initial_seconds, increment_seconds, max_players)
  values (auth.uid(), trim(p_name), p_initial_seconds, p_increment_seconds, p_max_players)
  returning id into v_id;
  insert into public.chess_tournament_players(tournament_id, user_id)
  values (v_id, auth.uid());
  return v_id;
end;
$$;

create or replace function public.list_chess_tournaments()
returns table (
  tournament_id uuid,
  name text,
  creator_username text,
  initial_seconds integer,
  increment_seconds integer,
  max_players integer,
  status text,
  player_count bigint,
  is_joined boolean,
  is_creator boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select t.id, t.name, p.username, t.initial_seconds, t.increment_seconds, t.max_players,
    t.status, count(tp.user_id), bool_or(tp.user_id = auth.uid()),
    t.creator_id = auth.uid(), t.created_at
  from public.chess_tournaments t
  join public.profiles p on p.id = t.creator_id
  left join public.chess_tournament_players tp on tp.tournament_id = t.id
  where auth.uid() is not null
  group by t.id, p.username
  order by case t.status when 'open' then 0 when 'running' then 1 else 2 end, t.created_at desc
  limit 100;
$$;

create or replace function public.join_chess_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tournament public.chess_tournaments%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  select * into v_tournament from public.chess_tournaments where id = p_tournament_id for update;
  if not found or v_tournament.status <> 'open' then raise exception 'Dieses Turnier nimmt keine Anmeldungen an'; end if;
  if exists (select 1 from public.community_suspensions s where s.user_id = v_actor and (s.expires_at is null or s.expires_at > now())) then
    raise exception using errcode = '42501', message = 'Du kannst dich mit einer aktiven Community-Sperre nicht anmelden';
  end if;
  if (select count(*) from public.chess_tournament_players where tournament_id = p_tournament_id) >= v_tournament.max_players then
    raise exception 'Das Turnier ist bereits voll';
  end if;
  insert into public.chess_tournament_players(tournament_id, user_id)
  values (p_tournament_id, v_actor)
  on conflict do nothing;
end;
$$;

create or replace function public.leave_chess_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tournament public.chess_tournaments%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  select * into v_tournament from public.chess_tournaments where id = p_tournament_id for update;
  if not found or v_tournament.status <> 'open' then raise exception 'Ein laufendes Turnier kann nicht verlassen werden'; end if;
  if v_tournament.creator_id = auth.uid() then raise exception 'Die erstellende Person kann das Turnier nicht verlassen'; end if;
  delete from public.chess_tournament_players where tournament_id = p_tournament_id and user_id = auth.uid();
end;
$$;

create or replace function public.start_chess_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tournament public.chess_tournaments%rowtype;
  v_count integer;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  select * into v_tournament from public.chess_tournaments where id = p_tournament_id for update;
  if not found or v_tournament.creator_id <> auth.uid() then raise exception using errcode = '42501', message = 'Nur die erstellende Person kann das Turnier starten'; end if;
  if v_tournament.status <> 'open' then raise exception 'Dieses Turnier wurde bereits gestartet'; end if;
  select count(*) into v_count from public.chess_tournament_players where tournament_id = p_tournament_id;
  if v_count < 2 then raise exception 'Mindestens zwei Spieler müssen angemeldet sein'; end if;

  insert into public.chess_tournament_games(tournament_id, white_user_id, black_user_id)
  select p_tournament_id, white.user_id, black.user_id
  from public.chess_tournament_players white
  join public.chess_tournament_players black
    on white.tournament_id = black.tournament_id and white.user_id < black.user_id
  where white.tournament_id = p_tournament_id;

  update public.chess_tournaments set status = 'running', started_at = now()
  where id = p_tournament_id;
end;
$$;

create or replace function public.list_chess_tournament_players(p_tournament_id uuid)
returns table (user_id uuid, username text, score numeric, is_creator boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_tournament_players where tournament_id = p_tournament_id and user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Du bist für dieses Turnier nicht angemeldet';
  end if;
  return query
  select tp.user_id, p.username, tp.score, t.creator_id = tp.user_id
  from public.chess_tournament_players tp
  join public.profiles p on p.id = tp.user_id
  join public.chess_tournaments t on t.id = tp.tournament_id
  where tp.tournament_id = p_tournament_id
  order by tp.score desc, p.username;
end;
$$;

create or replace function public.list_chess_tournament_games(p_tournament_id uuid)
returns table (
  game_id uuid,
  white_user_id uuid,
  white_username text,
  black_user_id uuid,
  black_username text,
  status text,
  result text,
  white_report text,
  black_report text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_tournament_players where tournament_id = p_tournament_id and user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Du bist für dieses Turnier nicht angemeldet';
  end if;
  return query
  select g.id, g.white_user_id, white.username, g.black_user_id, black.username,
    g.status, g.result, g.white_report, g.black_report
  from public.chess_tournament_games g
  join public.profiles white on white.id = g.white_user_id
  join public.profiles black on black.id = g.black_user_id
  where g.tournament_id = p_tournament_id
  order by white.username, black.username;
end;
$$;

create or replace function public.report_chess_tournament_result(p_game_id uuid, p_result text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_game public.chess_tournament_games%rowtype;
  v_actor uuid := auth.uid();
  v_status text;
  v_white_username text;
  v_black_username text;
  v_initial_seconds integer;
  v_increment_seconds integer;
  v_rating_mode text;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if p_result is null or p_result not in ('white', 'black', 'draw') then raise exception 'Ungültiges Ergebnis'; end if;

  select * into v_game from public.chess_tournament_games where id = p_game_id for update;
  if not found or v_actor not in (v_game.white_user_id, v_game.black_user_id) then
    raise exception using errcode = '42501', message = 'Du bist an dieser Turnierpartie nicht beteiligt';
  end if;
  if v_game.status = 'finished' then raise exception 'Dieses Ergebnis wurde bereits bestätigt'; end if;

  if v_actor = v_game.white_user_id then
    update public.chess_tournament_games set white_report = p_result where id = p_game_id;
    v_game.white_report := p_result;
  else
    update public.chess_tournament_games set black_report = p_result where id = p_game_id;
    v_game.black_report := p_result;
  end if;

  if v_game.white_report is not null and v_game.black_report is not null then
    if v_game.white_report = v_game.black_report then
      update public.chess_tournament_games
      set result = v_game.white_report, status = 'finished', finished_at = now()
      where id = p_game_id;

      select white.username, black.username, t.initial_seconds, t.increment_seconds
      into v_white_username, v_black_username, v_initial_seconds, v_increment_seconds
      from public.chess_tournaments t
      join public.profiles white on white.id = v_game.white_user_id
      join public.profiles black on black.id = v_game.black_user_id
      where t.id = v_game.tournament_id;

      v_rating_mode := case
        when (v_initial_seconds, v_increment_seconds) in ((60, 0), (120, 1)) then 'bullet'
        when (v_initial_seconds, v_increment_seconds) in ((180, 2), (300, 0), (300, 3)) then 'blitz'
        when (v_initial_seconds, v_increment_seconds) = (1800, 0) then 'classical'
        else 'rapid'
      end;

      perform public.record_online_chess_result(
        'tournament:' || v_game.tournament_id::text || ':' || v_game.id::text,
        v_rating_mode,
        v_white_username,
        v_black_username,
        v_game.white_report
      );

      update public.chess_tournament_players
      set score = score + case v_game.white_report when 'draw' then 0.5 else 1 end
      where tournament_id = v_game.tournament_id
        and user_id = case when v_game.white_report = 'white' then v_game.white_user_id
                           when v_game.white_report = 'black' then v_game.black_user_id
                           else null end;
      if v_game.white_report = 'draw' then
        update public.chess_tournament_players set score = score + 0.5
        where tournament_id = v_game.tournament_id and user_id in (v_game.white_user_id, v_game.black_user_id);
      end if;
      if not exists (
        select 1 from public.chess_tournament_games
        where tournament_id = v_game.tournament_id and id <> p_game_id and status <> 'finished'
      ) then
        update public.chess_tournaments set status = 'completed', completed_at = now()
        where id = v_game.tournament_id;
      end if;
      v_status := 'finished';
    else
      update public.chess_tournament_games set status = 'disputed' where id = p_game_id;
      v_status := 'disputed';
    end if;
  else
    v_status := 'pending';
  end if;
  return v_status;
end;
$$;

revoke all on function public.create_chess_tournament(text, integer, integer, integer) from public, anon;
revoke all on function public.list_chess_tournaments() from public, anon;
revoke all on function public.join_chess_tournament(uuid) from public, anon;
revoke all on function public.leave_chess_tournament(uuid) from public, anon;
revoke all on function public.start_chess_tournament(uuid) from public, anon;
revoke all on function public.list_chess_tournament_players(uuid) from public, anon;
revoke all on function public.list_chess_tournament_games(uuid) from public, anon;
revoke all on function public.report_chess_tournament_result(uuid, text) from public, anon;

grant execute on function public.create_chess_tournament(text, integer, integer, integer) to authenticated;
grant execute on function public.list_chess_tournaments() to authenticated;
grant execute on function public.join_chess_tournament(uuid) to authenticated;
grant execute on function public.leave_chess_tournament(uuid) to authenticated;
grant execute on function public.start_chess_tournament(uuid) to authenticated;
grant execute on function public.list_chess_tournament_players(uuid) to authenticated;
grant execute on function public.list_chess_tournament_games(uuid) to authenticated;
grant execute on function public.report_chess_tournament_result(uuid, text) to authenticated;

notify pgrst, 'reload schema';
