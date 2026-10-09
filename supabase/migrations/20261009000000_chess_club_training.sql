create table public.chess_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.chess_club_members (
  club_id uuid not null references public.chess_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'trainer', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.chess_club_groups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.chess_clubs(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id, club_id)
);

create table public.chess_club_group_members (
  group_id uuid not null references public.chess_club_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('trainer', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.chess_club_training_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chess_club_groups(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  due_at timestamptz,
  target_solutions integer check (target_solutions between 1 and 5000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id, group_id)
);

create table public.chess_club_training_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chess_club_groups(id) on delete cascade,
  plan_id uuid,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  puzzle_id text not null check (char_length(puzzle_id) between 1 and 80),
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chess_club_task_plan_group_fk
    foreign key (plan_id, group_id)
    references public.chess_club_training_plans(id, group_id)
    on delete cascade
);

create table public.chess_club_task_attempts (
  task_id uuid not null references public.chess_club_training_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  solved boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  primary key (task_id, user_id)
);

create index chess_club_groups_club_idx on public.chess_club_groups (club_id, created_at);
create index chess_club_group_members_user_idx on public.chess_club_group_members (user_id, group_id);
create index chess_club_training_tasks_group_idx on public.chess_club_training_tasks (group_id, created_at desc);
create index chess_club_training_tasks_plan_idx on public.chess_club_training_tasks (plan_id);
create index chess_club_task_attempts_user_idx on public.chess_club_task_attempts (user_id, task_id);

alter table public.chess_clubs enable row level security;
alter table public.chess_club_members enable row level security;
alter table public.chess_club_groups enable row level security;
alter table public.chess_club_group_members enable row level security;
alter table public.chess_club_training_plans enable row level security;
alter table public.chess_club_training_tasks enable row level security;
alter table public.chess_club_task_attempts enable row level security;
revoke all on public.chess_clubs, public.chess_club_members, public.chess_club_groups,
  public.chess_club_group_members, public.chess_club_training_plans,
  public.chess_club_training_tasks, public.chess_club_task_attempts from public, anon, authenticated;

create or replace function public.create_chess_club(p_name text, p_group_name text)
returns table (club_id uuid, group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_club_id uuid;
  v_group_id uuid;
  v_invite_code text;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 80 then raise exception 'Der Vereinsname muss 3 bis 80 Zeichen lang sein'; end if;
  if char_length(trim(coalesce(p_group_name, ''))) not between 2 and 80 then raise exception 'Der Gruppenname muss 2 bis 80 Zeichen lang sein'; end if;

  insert into public.chess_clubs(name, created_by)
  values (trim(p_name), v_actor)
  returning id into v_club_id;
  insert into public.chess_club_members(club_id, user_id, role)
  values (v_club_id, v_actor, 'owner');
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.chess_club_groups(club_id, name, invite_code, created_by)
  values (v_club_id, trim(p_group_name), v_invite_code, v_actor)
  returning id into v_group_id;
  insert into public.chess_club_group_members(group_id, user_id, role)
  values (v_group_id, v_actor, 'trainer');

  return query select v_club_id, v_group_id, v_invite_code;
end;
$$;

create or replace function public.create_chess_club_group(p_club_id uuid, p_name text)
returns table (group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_group_id uuid;
  v_invite_code text;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Der Gruppenname muss 2 bis 80 Zeichen lang sein'; end if;
  if not exists (
    select 1 from public.chess_club_members
    where club_id = p_club_id and user_id = v_actor and role in ('owner', 'trainer')
  ) then raise exception using errcode = '42501', message = 'Nur Trainer können Gruppen anlegen'; end if;

  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.chess_club_groups(club_id, name, invite_code, created_by)
  values (p_club_id, trim(p_name), v_invite_code, v_actor)
  returning id into v_group_id;
  insert into public.chess_club_group_members(group_id, user_id, role)
  values (v_group_id, v_actor, 'trainer');
  return query select v_group_id, v_invite_code;
end;
$$;

create or replace function public.join_chess_club_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_group public.chess_club_groups%rowtype;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  select * into v_group from public.chess_club_groups
  where invite_code = upper(trim(coalesce(p_invite_code, '')))
  for update;
  if not found then raise exception 'Einladungscode nicht gefunden'; end if;

  insert into public.chess_club_members(club_id, user_id, role)
  values (v_group.club_id, v_actor, 'member')
  on conflict (club_id, user_id) do nothing;
  insert into public.chess_club_group_members(group_id, user_id, role)
  values (v_group.id, v_actor, 'member')
  on conflict (group_id, user_id) do nothing;
  return v_group.id;
end;
$$;

create or replace function public.list_my_chess_club_groups()
returns table (
  group_id uuid,
  club_id uuid,
  club_name text,
  group_name text,
  role text,
  member_count bigint,
  invite_code text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select g.id, c.id, c.name, g.name,
    case when gm.role = 'trainer' or cm.role in ('owner', 'trainer') then 'trainer' else 'member' end,
    (select count(*) from public.chess_club_group_members member_count where member_count.group_id = g.id),
    case when gm.role = 'trainer' or cm.role in ('owner', 'trainer') then g.invite_code else null end
  from public.chess_club_groups g
  join public.chess_clubs c on c.id = g.club_id
  left join public.chess_club_group_members gm on gm.group_id = g.id and gm.user_id = auth.uid()
  left join public.chess_club_members cm on cm.club_id = c.id and cm.user_id = auth.uid()
  where auth.uid() is not null
    and gm.user_id is not null
  order by c.name, g.name;
$$;

create or replace function public.list_chess_club_group_members(p_group_id uuid)
returns table (user_id uuid, username text, role text, solved_tasks bigint, attempted_tasks bigint, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_club_group_members where group_id = p_group_id and user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'Du bist nicht Mitglied dieser Trainingsgruppe'; end if;

  return query
  select gm.user_id, p.username,
    case when gm.role = 'trainer' or cm.role in ('owner', 'trainer') then 'Trainer' else 'Mitglied' end,
    count(a.task_id) filter (where a.solved),
    count(a.task_id),
    gm.joined_at
  from public.chess_club_group_members gm
  join public.profiles p on p.id = gm.user_id
  join public.chess_club_groups g on g.id = gm.group_id
  left join public.chess_club_members cm on cm.club_id = g.club_id and cm.user_id = gm.user_id
  left join public.chess_club_training_tasks t on t.group_id = gm.group_id
  left join public.chess_club_task_attempts a on a.task_id = t.id and a.user_id = gm.user_id
  where gm.group_id = p_group_id
  group by gm.user_id, p.username, gm.role, cm.role, gm.joined_at
  order by case when gm.role = 'trainer' or cm.role in ('owner', 'trainer') then 0 else 1 end, p.username;
end;
$$;

create or replace function public.create_chess_club_training_plan(
  p_group_id uuid,
  p_name text,
  p_description text,
  p_due_at timestamptz,
  p_target_solutions integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_club_group_members gm
    join public.chess_club_groups g on g.id = gm.group_id
    left join public.chess_club_members cm on cm.club_id = g.club_id and cm.user_id = auth.uid()
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
      and (gm.role = 'trainer' or cm.role in ('owner', 'trainer'))
  ) then raise exception using errcode = '42501', message = 'Nur Trainer können Trainingspläne erstellen'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 100 then raise exception 'Der Planname muss 3 bis 100 Zeichen lang sein'; end if;
  if char_length(coalesce(p_description, '')) > 500 then raise exception 'Die Beschreibung darf höchstens 500 Zeichen lang sein'; end if;
  if p_target_solutions is not null and p_target_solutions not between 1 and 5000 then raise exception 'Das Teamziel muss zwischen 1 und 5000 gelösten Aufgaben liegen'; end if;
  if p_due_at is not null and p_due_at <= now() then raise exception 'Die Abgabefrist muss in der Zukunft liegen'; end if;

  insert into public.chess_club_training_plans(group_id, name, description, due_at, target_solutions, created_by)
  values (p_group_id, trim(p_name), trim(coalesce(p_description, '')), p_due_at, p_target_solutions, auth.uid())
  returning id into v_plan_id;
  return v_plan_id;
end;
$$;

create or replace function public.create_chess_club_training_task(
  p_group_id uuid,
  p_plan_id uuid,
  p_title text,
  p_description text,
  p_puzzle_id text,
  p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_task_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_club_group_members gm
    join public.chess_club_groups g on g.id = gm.group_id
    left join public.chess_club_members cm on cm.club_id = g.club_id and cm.user_id = auth.uid()
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
      and (gm.role = 'trainer' or cm.role in ('owner', 'trainer'))
  ) then raise exception using errcode = '42501', message = 'Nur Trainer können Aufgaben zuweisen'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 100 then raise exception 'Der Aufgabentitel muss 3 bis 100 Zeichen lang sein'; end if;
  if char_length(coalesce(p_description, '')) > 500 then raise exception 'Die Beschreibung darf höchstens 500 Zeichen lang sein'; end if;
  if char_length(coalesce(p_puzzle_id, '')) not between 1 and 80 then raise exception 'Ungültige Aufgabenstellung'; end if;
  if p_due_at is not null and p_due_at <= now() then raise exception 'Die Abgabefrist muss in der Zukunft liegen'; end if;
  if p_plan_id is not null and not exists (
    select 1 from public.chess_club_training_plans where id = p_plan_id and group_id = p_group_id
  ) then raise exception 'Trainingsplan nicht gefunden'; end if;

  insert into public.chess_club_training_tasks(group_id, plan_id, title, description, puzzle_id, due_at, created_by)
  values (p_group_id, p_plan_id, trim(p_title), trim(coalesce(p_description, '')), trim(p_puzzle_id), p_due_at, auth.uid())
  returning id into v_task_id;
  return v_task_id;
end;
$$;

create or replace function public.list_chess_club_training_plans(p_group_id uuid)
returns table (
  plan_id uuid,
  name text,
  description text,
  due_at timestamptz,
  target_solutions integer,
  task_count bigint,
  solved_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_club_group_members where group_id = p_group_id and user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'Du bist nicht Mitglied dieser Trainingsgruppe'; end if;

  return query
  select p.id, p.name, p.description, p.due_at, p.target_solutions,
    count(distinct t.id),
    count(a.task_id) filter (where a.solved)
  from public.chess_club_training_plans p
  left join public.chess_club_training_tasks t on t.plan_id = p.id
  left join public.chess_club_task_attempts a on a.task_id = t.id
  where p.group_id = p_group_id
  group by p.id
  order by p.due_at nulls last, p.created_at desc;
end;
$$;

create or replace function public.list_chess_club_training_tasks(p_group_id uuid)
returns table (
  task_id uuid,
  plan_id uuid,
  plan_name text,
  title text,
  description text,
  puzzle_id text,
  due_at timestamptz,
  participant_count bigint,
  attempted_count bigint,
  solved_count bigint,
  my_attempts integer,
  my_solved boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_club_group_members where group_id = p_group_id and user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'Du bist nicht Mitglied dieser Trainingsgruppe'; end if;

  return query
  select t.id, t.plan_id, p.name, t.title, t.description, t.puzzle_id, t.due_at,
    (select count(*) from public.chess_club_group_members gm where gm.group_id = p_group_id),
    count(a.user_id),
    count(a.user_id) filter (where a.solved),
    coalesce(mine.attempts, 0),
    coalesce(mine.solved, false)
  from public.chess_club_training_tasks t
  left join public.chess_club_training_plans p on p.id = t.plan_id
  left join public.chess_club_task_attempts a on a.task_id = t.id
  left join public.chess_club_task_attempts mine on mine.task_id = t.id and mine.user_id = auth.uid()
  where t.group_id = p_group_id
  group by t.id, p.name, mine.attempts, mine.solved
  order by t.due_at nulls last, t.created_at desc;
end;
$$;

create or replace function public.record_chess_club_training_attempt(p_task_id uuid, p_solved boolean)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if p_solved is null then raise exception 'Ungültiges Aufgabenergebnis'; end if;
  if not exists (
    select 1 from public.chess_club_training_tasks t
    join public.chess_club_group_members gm on gm.group_id = t.group_id
    where t.id = p_task_id and gm.user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'Du kannst diese Gruppenaufgabe nicht bearbeiten'; end if;

  insert into public.chess_club_task_attempts as current_attempts(task_id, user_id, solved, attempts, first_attempt_at, last_attempt_at)
  values (p_task_id, auth.uid(), p_solved, 1, now(), now())
  on conflict (task_id, user_id) do update
    set solved = current_attempts.solved or excluded.solved,
        attempts = current_attempts.attempts + 1,
        last_attempt_at = now();
end;
$$;

create or replace function public.list_chess_club_task_participation(p_task_id uuid)
returns table (user_id uuid, username text, role text, attempts integer, solved boolean, last_attempt_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.chess_club_training_tasks where id = p_task_id;
  if v_group_id is null then raise exception 'Aufgabe nicht gefunden'; end if;
  if auth.uid() is null or not exists (
    select 1 from public.chess_club_group_members gm
    join public.chess_club_groups g on g.id = gm.group_id
    left join public.chess_club_members cm on cm.club_id = g.club_id and cm.user_id = auth.uid()
    where gm.group_id = v_group_id and gm.user_id = auth.uid()
      and (gm.role = 'trainer' or cm.role in ('owner', 'trainer'))
  ) then raise exception using errcode = '42501', message = 'Nur Trainer können die Teilnahmeübersicht sehen'; end if;

  return query
  select gm.user_id, p.username,
    case when gm.role = 'trainer' or cm.role in ('owner', 'trainer') then 'Trainer' else 'Mitglied' end,
    coalesce(a.attempts, 0), coalesce(a.solved, false), a.last_attempt_at
  from public.chess_club_group_members gm
  join public.profiles p on p.id = gm.user_id
  join public.chess_club_groups g on g.id = gm.group_id
  left join public.chess_club_members cm on cm.club_id = g.club_id and cm.user_id = gm.user_id
  left join public.chess_club_task_attempts a on a.task_id = p_task_id and a.user_id = gm.user_id
  where gm.group_id = v_group_id
  order by case when gm.role = 'trainer' or cm.role in ('owner', 'trainer') then 0 else 1 end, p.username;
end;
$$;

alter table public.chess_tournaments
  add column club_group_id uuid references public.chess_club_groups(id) on delete cascade;
create index chess_tournaments_club_group_idx
  on public.chess_tournaments (club_group_id, status, created_at desc)
  where club_group_id is not null;

create or replace function public.enforce_chess_club_tournament_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_group_id uuid;
begin
  select club_group_id into v_group_id from public.chess_tournaments where id = new.tournament_id;
  if v_group_id is not null and not exists (
    select 1 from public.chess_club_group_members where group_id = v_group_id and user_id = new.user_id
  ) then
    raise exception using errcode = '42501', message = 'Dieses Vereinsturnier ist nur für Gruppenmitglieder';
  end if;
  return new;
end;
$$;

create trigger chess_club_tournament_membership_guard
before insert on public.chess_tournament_players
for each row execute function public.enforce_chess_club_tournament_membership();

create or replace function public.create_chess_club_group_tournament(
  p_group_id uuid,
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
  if not exists (
    select 1 from public.chess_club_group_members gm
    join public.chess_club_groups g on g.id = gm.group_id
    left join public.chess_club_members cm on cm.club_id = g.club_id and cm.user_id = auth.uid()
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
      and (gm.role = 'trainer' or cm.role in ('owner', 'trainer'))
  ) then raise exception using errcode = '42501', message = 'Nur Trainer können ein Vereinsturnier erstellen'; end if;
  if exists (select 1 from public.community_suspensions s where s.user_id = auth.uid() and (s.expires_at is null or s.expires_at > now())) then
    raise exception using errcode = '42501', message = 'Du kannst mit einer aktiven Community-Sperre kein Turnier erstellen';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 80 then raise exception 'Der Turniername muss 3 bis 80 Zeichen lang sein'; end if;
  if p_initial_seconds not between 60 and 3600 or p_increment_seconds not between 0 and 60 then raise exception 'Ungültige Bedenkzeit'; end if;
  if p_max_players not between 2 and 16 then raise exception 'Ein Turnier braucht Platz für 2 bis 16 Spieler'; end if;

  insert into public.chess_tournaments(creator_id, name, initial_seconds, increment_seconds, max_players, club_group_id)
  values (auth.uid(), trim(p_name), p_initial_seconds, p_increment_seconds, p_max_players, p_group_id)
  returning id into v_id;
  insert into public.chess_tournament_players(tournament_id, user_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

create or replace function public.list_chess_club_group_tournaments(p_group_id uuid)
returns table (
  tournament_id uuid,
  name text,
  initial_seconds integer,
  increment_seconds integer,
  max_players integer,
  status text,
  player_count bigint,
  is_joined boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.chess_club_group_members where group_id = p_group_id and user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'Du bist nicht Mitglied dieser Trainingsgruppe'; end if;

  return query
  select t.id, t.name, t.initial_seconds, t.increment_seconds, t.max_players, t.status,
    count(tp.user_id), bool_or(tp.user_id = auth.uid())
  from public.chess_tournaments t
  left join public.chess_tournament_players tp on tp.tournament_id = t.id
  where t.club_group_id = p_group_id
  group by t.id
  order by case t.status when 'open' then 0 when 'running' then 1 else 2 end, t.created_at desc;
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
    and (t.club_group_id is null or exists (
      select 1 from public.chess_club_group_members gm
      where gm.group_id = t.club_group_id and gm.user_id = auth.uid()
    ))
  group by t.id, p.username
  order by case t.status when 'open' then 0 when 'running' then 1 else 2 end, t.created_at desc
  limit 100;
$$;

revoke all on function public.enforce_chess_club_tournament_membership() from public, anon, authenticated;
revoke all on function public.create_chess_club(text, text) from public, anon;
revoke all on function public.create_chess_club_group(uuid, text) from public, anon;
revoke all on function public.join_chess_club_group(text) from public, anon;
revoke all on function public.list_my_chess_club_groups() from public, anon;
revoke all on function public.list_chess_club_group_members(uuid) from public, anon;
revoke all on function public.create_chess_club_training_plan(uuid, text, text, timestamptz, integer) from public, anon;
revoke all on function public.create_chess_club_training_task(uuid, uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.list_chess_club_training_plans(uuid) from public, anon;
revoke all on function public.list_chess_club_training_tasks(uuid) from public, anon;
revoke all on function public.record_chess_club_training_attempt(uuid, boolean) from public, anon;
revoke all on function public.list_chess_club_task_participation(uuid) from public, anon;
revoke all on function public.create_chess_club_group_tournament(uuid, text, integer, integer, integer) from public, anon;
revoke all on function public.list_chess_club_group_tournaments(uuid) from public, anon;
revoke all on function public.list_chess_tournaments() from public, anon;

grant execute on function public.create_chess_club(text, text) to authenticated;
grant execute on function public.create_chess_club_group(uuid, text) to authenticated;
grant execute on function public.join_chess_club_group(text) to authenticated;
grant execute on function public.list_my_chess_club_groups() to authenticated;
grant execute on function public.list_chess_club_group_members(uuid) to authenticated;
grant execute on function public.create_chess_club_training_plan(uuid, text, text, timestamptz, integer) to authenticated;
grant execute on function public.create_chess_club_training_task(uuid, uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.list_chess_club_training_plans(uuid) to authenticated;
grant execute on function public.list_chess_club_training_tasks(uuid) to authenticated;
grant execute on function public.record_chess_club_training_attempt(uuid, boolean) to authenticated;
grant execute on function public.list_chess_club_task_participation(uuid) to authenticated;
grant execute on function public.create_chess_club_group_tournament(uuid, text, integer, integer, integer) to authenticated;
grant execute on function public.list_chess_club_group_tournaments(uuid) to authenticated;
grant execute on function public.list_chess_tournaments() to authenticated;

notify pgrst, 'reload schema';
