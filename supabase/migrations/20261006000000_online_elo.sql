create table if not exists public.player_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_mode text not null check (game_mode in ('bullet', 'blitz', 'rapid', 'classical')),
  rating integer not null default 1200 check (rating >= 0),
  rated_games integer not null default 0 check (rated_games >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_mode)
);

create table if not exists public.online_rating_games (
  game_id text primary key,
  game_mode text not null check (game_mode in ('bullet', 'blitz', 'rapid', 'classical')),
  white_username text not null,
  black_username text not null,
  white_user_id uuid references auth.users (id) on delete set null,
  black_user_id uuid references auth.users (id) on delete set null,
  result text not null check (result in ('white', 'black', 'draw')),
  white_change integer,
  black_change integer,
  white_rating_after integer,
  black_rating_after integer,
  created_at timestamptz not null default now()
);

alter table public.player_ratings enable row level security;
alter table public.online_rating_games enable row level security;

drop policy if exists "Players can read their own ratings" on public.player_ratings;
create policy "Players can read their own ratings"
  on public.player_ratings for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.player_ratings from anon, authenticated;
grant select on public.player_ratings to authenticated;
revoke all on public.online_rating_games from anon, authenticated;

create or replace function public.get_public_player_ratings(p_username text)
returns table (
  username text,
  game_mode text,
  rating integer,
  rated_games integer,
  wins integer,
  draws integer,
  losses integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with target_profile as (
    select p.id, p.username
    from public.profiles p
    where p.username = p_username
    limit 1
  ), modes(game_mode) as (
    values ('bullet'), ('blitz'), ('rapid'), ('classical')
  )
  select
    target_profile.username,
    modes.game_mode,
    coalesce(player_ratings.rating, 1200),
    coalesce(player_ratings.rated_games, 0),
    coalesce(player_ratings.wins, 0),
    coalesce(player_ratings.draws, 0),
    coalesce(player_ratings.losses, 0)
  from target_profile
  cross join modes
  left join public.player_ratings
    on player_ratings.user_id = target_profile.id
    and player_ratings.game_mode = modes.game_mode;
$$;

revoke all on function public.get_public_player_ratings(text) from public;
grant execute on function public.get_public_player_ratings(text) to anon, authenticated;

create or replace function public.record_online_chess_result(
  p_game_id text,
  p_game_mode text,
  p_white_username text,
  p_black_username text,
  p_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_white_id uuid;
  v_black_id uuid;
  v_white_rating integer := 1200;
  v_black_rating integer := 1200;
  v_white_games integer := 0;
  v_black_games integer := 0;
  v_k integer;
  v_score numeric;
  v_expected numeric;
  v_white_change integer;
  v_black_change integer;
  v_my_change integer;
  v_my_rating integer;
  v_opponent_rating integer;
  v_claimed_game_id text;
  v_existing public.online_rating_games%rowtype;
begin
  if v_user_id is null then
    raise exception 'Anmeldung für eine Elo-Wertung erforderlich';
  end if;
  if p_game_id is null or length(p_game_id) = 0 or length(p_game_id) > 200 then
    raise exception 'Ungültige Partie-ID';
  end if;
  if p_game_mode is null or p_game_mode not in ('bullet', 'blitz', 'rapid', 'classical') then
    raise exception 'Ungültiger Spielmodus';
  end if;
  if p_result is null or p_result not in ('white', 'black', 'draw') then
    raise exception 'Ungültiges Spielergebnis';
  end if;
  if p_white_username is null or p_black_username is null or p_white_username = p_black_username then
    raise exception 'Ungültige Spielernamen';
  end if;

  select p.id into v_white_id from public.profiles p where p.username = p_white_username limit 1;
  select p.id into v_black_id from public.profiles p where p.username = p_black_username limit 1;
  if v_user_id is distinct from v_white_id and v_user_id is distinct from v_black_id then
    raise exception 'Nur ein Spieler dieser Partie kann die Elo-Wertung speichern';
  end if;

  insert into public.online_rating_games (
    game_id, game_mode, white_username, black_username,
    white_user_id, black_user_id, result
  ) values (
    p_game_id, p_game_mode, p_white_username, p_black_username,
    v_white_id, v_black_id, p_result
  )
  on conflict (game_id) do nothing
  returning game_id into v_claimed_game_id;

  if v_claimed_game_id is null then
    select * into v_existing
    from public.online_rating_games
    where game_id = p_game_id;
    if v_existing.game_mode <> p_game_mode
      or v_existing.white_username <> p_white_username
      or v_existing.black_username <> p_black_username
      or v_existing.result <> p_result
      or (v_user_id is distinct from v_existing.white_user_id and v_user_id is distinct from v_existing.black_user_id) then
      raise exception 'Diese Partie wurde bereits anders gewertet';
    end if;
    if v_user_id = v_existing.white_user_id then
      return jsonb_build_object('rating', v_existing.white_rating_after, 'delta', v_existing.white_change);
    end if;
    return jsonb_build_object('rating', v_existing.black_rating_after, 'delta', v_existing.black_change);
  end if;

  insert into public.player_ratings (user_id, game_mode)
  select player_id, p_game_mode
  from (values (v_white_id), (v_black_id)) as players(player_id)
  where player_id is not null
  on conflict (user_id, game_mode) do nothing;

  perform 1
  from public.player_ratings r
  where r.game_mode = p_game_mode
    and r.user_id in (v_white_id, v_black_id)
  order by r.user_id
  for update;

  select r.rating, r.rated_games into v_white_rating, v_white_games
  from public.player_ratings r
  where r.user_id = v_white_id and r.game_mode = p_game_mode
  for update;
  select r.rating, r.rated_games into v_black_rating, v_black_games
  from public.player_ratings r
  where r.user_id = v_black_id and r.game_mode = p_game_mode
  for update;

  if v_white_id is null then v_white_rating := 1200; v_white_games := 0; end if;
  if v_black_id is null then v_black_rating := 1200; v_black_games := 0; end if;
  if v_white_id is null or v_black_id is null then
    v_k := case when (case when v_user_id = v_white_id then coalesce(v_white_games, 0) else coalesce(v_black_games, 0) end) < 30 then 32 else 20 end;
  else
    v_k := case when coalesce(v_white_games, 0) < 30 or coalesce(v_black_games, 0) < 30 then 32 else 20 end;
  end if;
  v_score := case p_result when 'white' then 1 when 'draw' then 0.5 else 0 end;
  v_expected := 1 / (1 + power(10::numeric, (v_black_rating - v_white_rating)::numeric / 400));
  v_white_change := round(v_k * (v_score - v_expected))::integer;
  v_black_change := -v_white_change;

  if v_white_id is not null then
    update public.player_ratings r
    set rating = v_white_rating + v_white_change,
        rated_games = r.rated_games + 1,
        wins = r.wins + case when p_result = 'white' then 1 else 0 end,
        draws = r.draws + case when p_result = 'draw' then 1 else 0 end,
        losses = r.losses + case when p_result = 'black' then 1 else 0 end,
        updated_at = now()
    where r.user_id = v_white_id and r.game_mode = p_game_mode;
  end if;
  if v_black_id is not null then
    update public.player_ratings r
    set rating = v_black_rating + v_black_change,
        rated_games = r.rated_games + 1,
        wins = r.wins + case when p_result = 'black' then 1 else 0 end,
        draws = r.draws + case when p_result = 'draw' then 1 else 0 end,
        losses = r.losses + case when p_result = 'white' then 1 else 0 end,
        updated_at = now()
    where r.user_id = v_black_id and r.game_mode = p_game_mode;
  end if;

  update public.online_rating_games
  set white_change = case when v_white_id is null then null else v_white_change end,
      black_change = case when v_black_id is null then null else v_black_change end,
      white_rating_after = case when v_white_id is null then null else v_white_rating + v_white_change end,
      black_rating_after = case when v_black_id is null then null else v_black_rating + v_black_change end
  where game_id = p_game_id;

  if v_user_id = v_white_id then
    v_my_change := v_white_change;
    v_my_rating := v_white_rating + v_white_change;
    v_opponent_rating := v_black_rating + case when v_black_id is null then 0 else v_black_change end;
  else
    v_my_change := v_black_change;
    v_my_rating := v_black_rating + v_black_change;
    v_opponent_rating := v_white_rating + case when v_white_id is null then 0 else v_white_change end;
  end if;
  return jsonb_build_object('rating', v_my_rating, 'delta', v_my_change, 'opponentRating', v_opponent_rating);
end;
$$;

revoke all on function public.record_online_chess_result(text, text, text, text, text) from public;
grant execute on function public.record_online_chess_result(text, text, text, text, text) to authenticated;