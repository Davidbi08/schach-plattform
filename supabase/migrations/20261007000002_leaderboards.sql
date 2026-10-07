create index if not exists player_ratings_leaderboard_idx
  on public.player_ratings (game_mode, rating desc, user_id)
  where rated_games > 0;

create or replace function public.get_global_leaderboard(p_game_mode text)
returns table (
  "position" bigint,
  user_id uuid,
  username text,
  avatar_url text,
  rating integer,
  rated_games integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_game_mode is null or p_game_mode not in ('bullet', 'blitz', 'rapid', 'classical') then
    raise exception 'Ungültiger Spielmodus';
  end if;

  return query
  select ranked.position, ranked.user_id, ranked.username, ranked.avatar_url, ranked.rating, ranked.rated_games
  from (
    select
      row_number() over (order by r.rating desc, p.username, p.id) as position,
      p.id as user_id,
      p.username,
      p.avatar_url,
      r.rating,
      r.rated_games
    from public.player_ratings r
    join public.profiles p on p.id = r.user_id
    where r.game_mode = p_game_mode
      and r.rated_games > 0
  ) ranked
  where ranked.position <= 100
  order by ranked.position;
end;
$$;

create or replace function public.get_friends_leaderboard(p_game_mode text)
returns table (
  "position" bigint,
  user_id uuid,
  username text,
  avatar_url text,
  rating integer,
  rated_games integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_game_mode is null or p_game_mode not in ('bullet', 'blitz', 'rapid', 'classical') then
    raise exception 'Ungültiger Spielmodus';
  end if;

  return query
  select
    row_number() over (order by r.rating desc, p.username, p.id) as position,
    p.id as user_id,
    p.username,
    p.avatar_url,
    r.rating,
    r.rated_games
  from (
    select auth.uid() as user_id
    union
    select case when f.requester_id = auth.uid() then f.recipient_id else f.requester_id end
    from public.friend_requests f
    where f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
  ) community
  join public.player_ratings r on r.user_id = community.user_id and r.game_mode = p_game_mode
  join public.profiles p on p.id = community.user_id
  where r.rated_games > 0
  order by r.rating desc, p.username, p.id;
end;
$$;

revoke all on function public.get_global_leaderboard(text) from public;
revoke all on function public.get_friends_leaderboard(text) from public;
grant execute on function public.get_global_leaderboard(text) to anon, authenticated;
grant execute on function public.get_friends_leaderboard(text) to authenticated;
