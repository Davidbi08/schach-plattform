create or replace function public.list_chess_tournament_players(p_tournament_id uuid)
returns table (user_id uuid, username text, score numeric, is_creator boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.chess_tournament_players as participant
    where participant.tournament_id = p_tournament_id
      and participant.user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Du bist für dieses Turnier nicht angemeldet';
  end if;

  return query
  select participant.user_id, player_profile.username, participant.score,
    tournament.creator_id = participant.user_id
  from public.chess_tournament_players as participant
  join public.profiles as player_profile on player_profile.id = participant.user_id
  join public.chess_tournaments as tournament on tournament.id = participant.tournament_id
  where participant.tournament_id = p_tournament_id
  order by participant.score desc, player_profile.username;
end;
$$;

revoke all on function public.list_chess_tournament_players(uuid) from public, anon;
grant execute on function public.list_chess_tournament_players(uuid) to authenticated;

notify pgrst, 'reload schema';
