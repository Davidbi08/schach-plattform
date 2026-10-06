create table if not exists public.player_rating_placements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  skill_level text not null check (skill_level in ('beginner','casual','intermediate','advanced','expert')),
  initial_rating integer not null check (initial_rating between 0 and 3000),
  created_at timestamptz not null default now()
);
alter table public.player_rating_placements enable row level security;
revoke all on public.player_rating_placements from anon, authenticated;
grant select on public.player_rating_placements to authenticated;
drop policy if exists "Players can read their own rating placement" on public.player_rating_placements;
create policy "Players can read their own rating placement" on public.player_rating_placements for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.get_public_player_ratings(p_username text)
returns table(username text,game_mode text,rating integer,rated_games integer,wins integer,draws integer,losses integer)
language sql stable security definer set search_path=public,pg_temp as $$
  with target_profile as (
    select p.id,p.username from public.profiles p join public.player_rating_placements x on x.user_id=p.id where p.username=p_username limit 1
  ), modes(game_mode) as (values('bullet'),('blitz'),('rapid'),('classical'))
  select target_profile.username,modes.game_mode,coalesce(r.rating,1200),coalesce(r.rated_games,0),coalesce(r.wins,0),coalesce(r.draws,0),coalesce(r.losses,0)
  from target_profile cross join modes left join public.player_ratings r on r.user_id=target_profile.id and r.game_mode=modes.game_mode;
$$;
revoke all on function public.get_public_player_ratings(text) from public;
grant execute on function public.get_public_player_ratings(text) to anon,authenticated;

create or replace function public.set_online_rating_placement(p_skill_level text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid(); v_initial_rating integer; v_saved public.player_rating_placements%rowtype;
begin
  if v_user_id is null then raise exception 'Anmeldung erforderlich'; end if;
  v_initial_rating:=case p_skill_level when 'beginner' then 800 when 'casual' then 1000 when 'intermediate' then 1300 when 'advanced' then 1600 when 'expert' then 1900 else null end;
  if v_initial_rating is null then raise exception 'Ungültige Selbsteinstufung'; end if;
  insert into public.player_rating_placements(user_id,skill_level,initial_rating) values(v_user_id,p_skill_level,v_initial_rating) on conflict(user_id) do nothing;
  select * into v_saved from public.player_rating_placements where user_id=v_user_id;
  insert into public.player_ratings(user_id,game_mode,rating) select v_user_id,mode,v_saved.initial_rating from (values('bullet'),('blitz'),('rapid'),('classical')) as modes(mode) on conflict(user_id,game_mode) do nothing;
  return jsonb_build_object('skillLevel',v_saved.skill_level,'initialRating',v_saved.initial_rating);
end; $$;
revoke all on function public.set_online_rating_placement(text) from public;
grant execute on function public.set_online_rating_placement(text) to authenticated;

create or replace function public.record_online_chess_result(p_game_id text,p_game_mode text,p_white_username text,p_black_username text,p_result text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user_id uuid:=auth.uid(); v_white_id uuid; v_black_id uuid; v_white_rating integer:=1200; v_black_rating integer:=1200;
  v_white_games integer:=0; v_black_games integer:=0; v_white_k integer:=32; v_black_k integer:=32;
  v_expected numeric; v_score numeric; v_white_change integer; v_black_change integer; v_my_change integer; v_my_rating integer;
  v_my_games integer; v_opponent_rating integer; v_claimed_game_id text; v_existing public.online_rating_games%rowtype;
begin
  if v_user_id is null then raise exception 'Anmeldung für eine Elo-Wertung erforderlich'; end if;
  if p_game_id is null or length(p_game_id)=0 or length(p_game_id)>200 then raise exception 'Ungültige Partie-ID'; end if;
  if p_game_mode is null or p_game_mode not in('bullet','blitz','rapid','classical') then raise exception 'Ungültiger Spielmodus'; end if;
  if p_result is null or p_result not in('white','black','draw') then raise exception 'Ungültiges Spielergebnis'; end if;
  if p_white_username is null or p_black_username is null or p_white_username=p_black_username then raise exception 'Ungültige Spielernamen'; end if;
  select id into v_white_id from public.profiles where username=p_white_username limit 1;
  select id into v_black_id from public.profiles where username=p_black_username limit 1;
  if v_user_id is distinct from v_white_id and v_user_id is distinct from v_black_id then raise exception 'Nur ein Spieler dieser Partie kann die Elo-Wertung speichern'; end if;
  if not exists(select 1 from public.player_rating_placements where user_id=v_user_id) then raise exception 'Bitte wähle zuerst deine Einstufung'; end if;
  insert into public.online_rating_games(game_id,game_mode,white_username,black_username,white_user_id,black_user_id,result)
    values(p_game_id,p_game_mode,p_white_username,p_black_username,v_white_id,v_black_id,p_result) on conflict(game_id) do nothing returning game_id into v_claimed_game_id;
  if v_claimed_game_id is null then
    select * into v_existing from public.online_rating_games where game_id=p_game_id;
    if v_existing.game_mode<>p_game_mode or v_existing.white_username<>p_white_username or v_existing.black_username<>p_black_username or v_existing.result<>p_result or (v_user_id is distinct from v_existing.white_user_id and v_user_id is distinct from v_existing.black_user_id) then raise exception 'Diese Partie wurde bereits anders gewertet'; end if;
    if v_user_id=v_existing.white_user_id then return jsonb_build_object('rating',v_existing.white_rating_after,'delta',v_existing.white_change); end if;
    return jsonb_build_object('rating',v_existing.black_rating_after,'delta',v_existing.black_change);
  end if;
  insert into public.player_ratings(user_id,game_mode) select player_id,p_game_mode from (values(v_white_id),(v_black_id)) as players(player_id) where player_id is not null on conflict(user_id,game_mode) do nothing;
  perform 1 from public.player_ratings r where r.game_mode=p_game_mode and r.user_id in(v_white_id,v_black_id) order by r.user_id for update;
  select rating,rated_games into v_white_rating,v_white_games from public.player_ratings where user_id=v_white_id and game_mode=p_game_mode for update;
  select rating,rated_games into v_black_rating,v_black_games from public.player_ratings where user_id=v_black_id and game_mode=p_game_mode for update;
  if v_white_id is null then v_white_rating:=1200; v_white_games:=0; end if;
  if v_black_id is null then v_black_rating:=1200; v_black_games:=0; end if;
  v_white_k:=case when coalesce(v_white_games,0)<5 then 80 when coalesce(v_white_games,0)<30 then 32 else 20 end;
  v_black_k:=case when coalesce(v_black_games,0)<5 then 80 when coalesce(v_black_games,0)<30 then 32 else 20 end;
  v_score:=case p_result when 'white' then 1 when 'draw' then 0.5 else 0 end;
  v_expected:=1/(1+power(10::numeric,(v_black_rating-v_white_rating)::numeric/400));
  v_white_change:=round(v_white_k*(v_score-v_expected))::integer;
  v_black_change:=round(v_black_k*((1-v_score)-(1-v_expected)))::integer;
  if v_white_id is not null then update public.player_ratings r set rating=greatest(0,v_white_rating+v_white_change),rated_games=r.rated_games+1,wins=r.wins+case when p_result='white' then 1 else 0 end,draws=r.draws+case when p_result='draw' then 1 else 0 end,losses=r.losses+case when p_result='black' then 1 else 0 end,updated_at=now() where r.user_id=v_white_id and r.game_mode=p_game_mode; end if;
  if v_black_id is not null then update public.player_ratings r set rating=greatest(0,v_black_rating+v_black_change),rated_games=r.rated_games+1,wins=r.wins+case when p_result='black' then 1 else 0 end,draws=r.draws+case when p_result='draw' then 1 else 0 end,losses=r.losses+case when p_result='white' then 1 else 0 end,updated_at=now() where r.user_id=v_black_id and r.game_mode=p_game_mode; end if;
  update public.online_rating_games set white_change=case when v_white_id is null then null else v_white_change end,black_change=case when v_black_id is null then null else v_black_change end,white_rating_after=case when v_white_id is null then null else greatest(0,v_white_rating+v_white_change) end,black_rating_after=case when v_black_id is null then null else greatest(0,v_black_rating+v_black_change) end where game_id=p_game_id;
  if v_user_id=v_white_id then
    v_my_change:=v_white_change; v_my_rating:=greatest(0,v_white_rating+v_white_change); v_my_games:=coalesce(v_white_games,0)+1; v_opponent_rating:=case when v_black_id is null then v_black_rating else greatest(0,v_black_rating+v_black_change) end;
  else
    v_my_change:=v_black_change; v_my_rating:=greatest(0,v_black_rating+v_black_change); v_my_games:=coalesce(v_black_games,0)+1; v_opponent_rating:=case when v_white_id is null then v_white_rating else greatest(0,v_white_rating+v_white_change) end;
  end if;
  return jsonb_build_object('rating',v_my_rating,'delta',v_my_change,'opponentRating',v_opponent_rating,'ratedGames',v_my_games,'provisional',v_my_games<5);
end; $$;
revoke all on function public.record_online_chess_result(text,text,text,text,text) from public;
grant execute on function public.record_online_chess_result(text,text,text,text,text) to authenticated;