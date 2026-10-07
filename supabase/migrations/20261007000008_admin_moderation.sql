create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'moderator')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_user_created_idx
  on public.admin_notifications (user_id, created_at desc);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  chat_type text not null check (chat_type in ('global', 'direct')),
  message_id uuid not null,
  message_body text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint chat_reports_not_self check (reporter_id <> reported_user_id),
  constraint chat_reports_unique_message unique (reporter_id, chat_type, message_id)
);

create index if not exists chat_reports_status_created_idx
  on public.chat_reports (status, created_at desc);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.site_admins enable row level security;
alter table public.community_suspensions enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.chat_reports enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on public.site_admins, public.community_suspensions,
  public.admin_notifications, public.chat_reports, public.admin_audit_log
  from public, anon, authenticated;

create or replace function public.is_site_admin(p_roles text[] default array['owner', 'admin', 'moderator'])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.site_admins a
    where a.user_id = auth.uid() and a.role = any(p_roles)
  );
$$;

revoke all on function public.is_site_admin(text[]) from public, anon, authenticated;
grant execute on function public.is_site_admin(text[]) to authenticated;

drop policy if exists "Admins can remove profile avatars" on storage.objects;
create policy "Admins can remove profile avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and public.is_site_admin(array['owner', 'admin', 'moderator']));

create or replace function public.assert_user_not_community_suspended(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.community_suspensions s
    where s.user_id = p_user_id
      and (s.expires_at is null or s.expires_at > now())
  ) then
    raise exception using
      errcode = '42501',
      message = 'Dieser Nutzer ist vom Community-Bereich ausgeschlossen';
  end if;
end;
$$;

create or replace function public.enforce_community_suspension()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'global_chat_messages' or tg_table_name = 'direct_messages' then
    perform public.assert_user_not_community_suspended(new.sender_id);
  elsif tg_table_name = 'friend_requests' then
    perform public.assert_user_not_community_suspended(new.requester_id);
    perform public.assert_user_not_community_suspended(new.recipient_id);
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_global_chat_suspension on public.global_chat_messages;
create trigger enforce_global_chat_suspension
  before insert on public.global_chat_messages
  for each row execute function public.enforce_community_suspension();

drop trigger if exists enforce_direct_message_suspension on public.direct_messages;
create trigger enforce_direct_message_suspension
  before insert on public.direct_messages
  for each row execute function public.enforce_community_suspension();

drop trigger if exists enforce_friend_request_suspension on public.friend_requests;
create trigger enforce_friend_request_suspension
  before insert or update on public.friend_requests
  for each row execute function public.enforce_community_suspension();

revoke all on function public.assert_user_not_community_suspended(uuid) from public, anon, authenticated;
revoke all on function public.enforce_community_suspension() from public, anon, authenticated;

create or replace function public.get_my_admin_access()
returns table (role text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select a.role from public.site_admins a where a.user_id = auth.uid();
$$;

create or replace function public.get_my_community_suspension()
returns table (is_suspended boolean, reason text, expires_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (s.expires_at is null or s.expires_at > now()), s.reason, s.expires_at
  from public.community_suspensions s
  where s.user_id = auth.uid();
$$;

revoke all on function public.get_my_admin_access() from public, anon;
revoke all on function public.get_my_community_suspension() from public, anon;
grant execute on function public.get_my_admin_access() to authenticated;
grant execute on function public.get_my_community_suspension() to authenticated;

create or replace function public.admin_search_users(p_query text)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  is_suspended boolean,
  reason text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_site_admin(array['owner', 'admin', 'moderator']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if length(trim(coalesce(p_query, ''))) < 2 then
    raise exception 'Bitte mindestens zwei Zeichen eingeben';
  end if;

  return query
  select p.id, p.username, p.avatar_url,
    (s.user_id is not null and (s.expires_at is null or s.expires_at > now())),
    s.reason, s.expires_at
  from public.profiles p
  left join public.community_suspensions s on s.user_id = p.id
  where p.username ilike '%' || left(trim(p_query), 40) || '%'
  order by p.username
  limit 50;
end;
$$;

create or replace function public.admin_set_community_suspension(
  p_user_id uuid,
  p_reason text,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not public.is_site_admin(array['owner', 'admin', 'moderator']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Du kannst dein eigenes Konto nicht sperren';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'Der Grund muss zwischen 5 und 500 Zeichen lang sein';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Das Ablaufdatum muss in der Zukunft liegen';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Nutzer nicht gefunden';
  end if;
  if exists (select 1 from public.site_admins a where a.user_id = p_user_id and a.role = 'owner')
    or (exists (select 1 from public.site_admins a where a.user_id = p_user_id and a.role = 'admin')
      and not public.is_site_admin(array['owner'])) then
    raise exception 'Dieses Admin-Konto kann nicht durch diese Funktion gesperrt werden';
  end if;

  insert into public.community_suspensions(user_id, reason, expires_at, created_by)
  values (p_user_id, trim(p_reason), p_expires_at, v_actor)
  on conflict (user_id) do update
  set reason = excluded.reason, expires_at = excluded.expires_at,
      created_by = excluded.created_by, created_at = now();

  insert into public.admin_audit_log(actor_id, action, target_user_id, details)
  values (v_actor, 'community_suspension_set', p_user_id,
    jsonb_build_object('reason', trim(p_reason), 'expires_at', p_expires_at));
end;
$$;

create or replace function public.admin_clear_community_suspension(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.community_suspensions%rowtype;
begin
  if not public.is_site_admin(array['owner', 'admin', 'moderator']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if exists (select 1 from public.site_admins a where a.user_id = p_user_id and a.role = 'owner')
    or (exists (select 1 from public.site_admins a where a.user_id = p_user_id and a.role = 'admin')
      and not public.is_site_admin(array['owner'])) then
    raise exception 'Dieses Admin-Konto kann nicht durch diese Funktion entsperrt werden';
  end if;

  delete from public.community_suspensions s
  where s.user_id = p_user_id
  returning * into v_previous;

  if found then
    insert into public.admin_audit_log(actor_id, action, target_user_id, details)
    values (v_actor, 'community_suspension_cleared', p_user_id,
      jsonb_build_object('previous_reason', v_previous.reason));
  end if;
end;
$$;

create or replace function public.admin_moderate_profile(
  p_user_id uuid,
  p_remove_bio boolean,
  p_remove_avatar boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_previous_avatar text;
begin
  if not public.is_site_admin(array['owner', 'admin', 'moderator']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Du kannst dein eigenes Profil nicht moderieren';
  end if;
  if not coalesce(p_remove_bio, false) and not coalesce(p_remove_avatar, false) then
    raise exception 'Wähle mindestens ein Profilfeld aus';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'Der Grund muss zwischen 5 und 500 Zeichen lang sein';
  end if;
  if exists (select 1 from public.site_admins a where a.user_id = p_user_id and a.role = 'owner')
    or (exists (select 1 from public.site_admins a where a.user_id = p_user_id and a.role = 'admin')
      and not public.is_site_admin(array['owner'])) then
    raise exception 'Dieses Admin-Profil kann nicht durch diese Funktion moderiert werden';
  end if;

  select p.avatar_url into v_previous_avatar
  from public.profiles p where p.id = p_user_id for update;
  if not found then raise exception 'Nutzerprofil nicht gefunden'; end if;

  update public.profiles p
  set bio = case when coalesce(p_remove_bio, false) then '' else p.bio end,
      avatar_url = case when coalesce(p_remove_avatar, false) then null else p.avatar_url end
  where p.id = p_user_id;

  insert into public.admin_audit_log(actor_id, action, target_user_id, details)
  values (v_actor, 'profile_content_removed', p_user_id,
    jsonb_build_object('bio_removed', coalesce(p_remove_bio, false),
      'avatar_removed', coalesce(p_remove_avatar, false), 'reason', trim(p_reason)));

  return jsonb_build_object(
    'user_id', p_user_id,
    'avatar_url', case when coalesce(p_remove_avatar, false) then v_previous_avatar else null end
  );
end;
$$;

create or replace function public.admin_send_user_notice(p_user_id uuid, p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_notice_id uuid;
begin
  if not public.is_site_admin(array['owner', 'admin', 'moderator']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Bitte einen anderen Nutzer auswählen';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 3 and 100
    or length(trim(coalesce(p_body, ''))) not between 3 and 2000 then
    raise exception 'Titel oder Nachricht hat eine ungültige Länge';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Nutzer nicht gefunden';
  end if;

  insert into public.admin_notifications(user_id, created_by, title, body)
  values (p_user_id, v_actor, trim(p_title), trim(p_body))
  returning id into v_notice_id;
  insert into public.admin_audit_log(actor_id, action, target_user_id, details)
  values (v_actor, 'admin_notice_sent', p_user_id,
    jsonb_build_object('notice_id', v_notice_id, 'title', trim(p_title)));
  return v_notice_id;
end;
$$;

create or replace function public.get_my_admin_notifications()
returns table (id uuid, title text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select n.id, n.title, n.body, n.created_at
  from public.admin_notifications n
  where n.user_id = auth.uid() and n.read_at is null
  order by n.created_at desc
  limit 20;
$$;

create or replace function public.mark_admin_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.admin_notifications n
  set read_at = now()
  where n.id = p_notification_id and n.user_id = auth.uid() and n.read_at is null;
$$;

create or replace function public.report_chat_message(
  p_chat_type text,
  p_message_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reported_user_id uuid;
  v_body text;
  v_report_id uuid;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_chat_type not in ('global', 'direct') then raise exception 'Ungültiger Chattyp'; end if;
  if length(trim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'Der Meldegrund muss zwischen 5 und 500 Zeichen lang sein';
  end if;

  if p_chat_type = 'global' then
    select m.sender_id, m.body into v_reported_user_id, v_body
    from public.global_chat_messages m where m.id = p_message_id;
  else
    select m.sender_id, m.body into v_reported_user_id, v_body
    from public.direct_messages m
    where m.id = p_message_id
      and (m.sender_id = auth.uid() or m.recipient_id = auth.uid());
    if found and not exists (
      select 1 from public.direct_messages m
      where m.id = p_message_id and m.sender_id = auth.uid()
    ) and not exists (
      select 1 from public.friend_requests f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.recipient_id = v_reported_user_id)
          or (f.requester_id = v_reported_user_id and f.recipient_id = auth.uid()))
    ) then
      raise exception 'Du kannst diese private Nachricht nicht melden';
    end if;
  end if;

  if v_reported_user_id is null then raise exception 'Nachricht nicht gefunden'; end if;
  if v_reported_user_id = auth.uid() then raise exception 'Du kannst deine eigene Nachricht nicht melden'; end if;

  insert into public.chat_reports(
    reporter_id, reported_user_id, chat_type, message_id, message_body, reason
  ) values (
    auth.uid(), v_reported_user_id, p_chat_type, p_message_id, v_body, trim(p_reason)
  )
  returning id into v_report_id;
  return v_report_id;
exception
  when unique_violation then
    raise exception 'Diese Nachricht hast du bereits gemeldet';
end;
$$;

create or replace function public.admin_list_chat_reports(p_status text default 'open')
returns table (
  report_id uuid,
  chat_type text,
  message_id uuid,
  message_body text,
  reason text,
  status text,
  created_at timestamptz,
  reporter_username text,
  reported_username text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_site_admin(array['owner', 'admin', 'moderator']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if p_status is null or p_status not in ('open', 'resolved', 'dismissed', 'all') then
    raise exception 'Ungültiger Meldungsstatus';
  end if;

  return query
  select r.id, r.chat_type, r.message_id, r.message_body, r.reason, r.status,
    r.created_at, reporter.username, reported.username
  from public.chat_reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  join public.profiles reported on reported.id = r.reported_user_id
  where p_status = 'all' or r.status = p_status
  order by r.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_resolve_chat_report(
  p_report_id uuid,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_report public.chat_reports%rowtype;
begin
  if not public.is_site_admin(array['owner', 'admin', 'moderator']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if p_resolution not in ('dismiss', 'remove_message') then
    raise exception 'Ungültige Moderationsaktion';
  end if;

  select * into v_report from public.chat_reports r
  where r.id = p_report_id and r.status = 'open'
  for update;
  if not found then raise exception 'Offene Meldung nicht gefunden'; end if;

  if p_resolution = 'remove_message' then
    if v_report.chat_type = 'global' then
      delete from public.global_chat_messages m where m.id = v_report.message_id;
    else
      delete from public.direct_messages m where m.id = v_report.message_id;
    end if;
  end if;

  update public.chat_reports r
  set status = case when p_resolution = 'dismiss' then 'dismissed' else 'resolved' end,
      resolution = p_resolution, resolved_by = v_actor, resolved_at = now(),
      message_body = ''
  where r.id = p_report_id;

  insert into public.admin_audit_log(actor_id, action, target_user_id, details)
  values (v_actor, 'chat_report_' || p_resolution, v_report.reported_user_id,
    jsonb_build_object('report_id', p_report_id, 'chat_type', v_report.chat_type,
      'message_id', v_report.message_id, 'reason', v_report.reason));
end;
$$;

create or replace function public.admin_list_audit_log()
returns table (
  action text,
  actor_username text,
  target_username text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_site_admin(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;

  return query
  select l.action, actor.username, target.username, l.details, l.created_at
  from public.admin_audit_log l
  left join public.profiles actor on actor.id = l.actor_id
  left join public.profiles target on target.id = l.target_user_id
  order by l.created_at desc
  limit 100;
end;
$$;

revoke all on function public.admin_search_users(text) from public, anon;
revoke all on function public.admin_set_community_suspension(uuid, text, timestamptz) from public, anon;
revoke all on function public.admin_clear_community_suspension(uuid) from public, anon;
revoke all on function public.admin_moderate_profile(uuid, boolean, boolean, text) from public, anon;
revoke all on function public.admin_send_user_notice(uuid, text, text) from public, anon;
revoke all on function public.get_my_admin_notifications() from public, anon;
revoke all on function public.mark_admin_notification_read(uuid) from public, anon;
revoke all on function public.report_chat_message(text, uuid, text) from public, anon;
revoke all on function public.admin_list_chat_reports(text) from public, anon;
revoke all on function public.admin_resolve_chat_report(uuid, text) from public, anon;
revoke all on function public.admin_list_audit_log() from public, anon;

grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_set_community_suspension(uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_clear_community_suspension(uuid) to authenticated;
grant execute on function public.admin_moderate_profile(uuid, boolean, boolean, text) to authenticated;
grant execute on function public.admin_send_user_notice(uuid, text, text) to authenticated;
grant execute on function public.get_my_admin_notifications() to authenticated;
grant execute on function public.mark_admin_notification_read(uuid) to authenticated;
grant execute on function public.report_chat_message(text, uuid, text) to authenticated;
grant execute on function public.admin_list_chat_reports(text) to authenticated;
grant execute on function public.admin_resolve_chat_report(uuid, text) to authenticated;
grant execute on function public.admin_list_audit_log() to authenticated;

notify pgrst, 'reload schema';
