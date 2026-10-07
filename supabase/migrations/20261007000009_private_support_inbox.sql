create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('problem', 'suggestion', 'other')),
  subject text not null check (char_length(subject) between 3 and 120),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_updated_idx
  on public.support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_status_updated_idx
  on public.support_tickets (status, updated_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
revoke all on public.support_tickets, public.support_ticket_messages from public, anon, authenticated;

create or replace function public.support_create_ticket(
  p_category text,
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ticket_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if p_category is null or p_category not in ('problem', 'suggestion', 'other') then
    raise exception 'Ungültige Support-Kategorie';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 3 and 120 then
    raise exception 'Der Betreff muss zwischen 3 und 120 Zeichen lang sein';
  end if;
  if char_length(trim(coalesce(p_message, ''))) not between 10 and 5000 then
    raise exception 'Die Nachricht muss zwischen 10 und 5000 Zeichen lang sein';
  end if;

  insert into public.support_tickets(user_id, category, subject)
  values (auth.uid(), p_category, trim(p_subject))
  returning id into v_ticket_id;

  insert into public.support_ticket_messages(ticket_id, sender_id, body)
  values (v_ticket_id, auth.uid(), trim(p_message));
  return v_ticket_id;
end;
$$;

create or replace function public.support_list_my_tickets()
returns table (
  ticket_id uuid,
  category text,
  subject text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select t.id, t.category, t.subject, t.status, t.created_at, t.updated_at
  from public.support_tickets t
  where t.user_id = auth.uid()
  order by t.updated_at desc
  limit 100;
$$;

create or replace function public.admin_list_support_tickets(p_status text default 'open')
returns table (
  ticket_id uuid,
  user_id uuid,
  username text,
  category text,
  subject text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  latest_message text,
  latest_message_at timestamptz
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
  if p_status is null or p_status not in ('open', 'in_progress', 'resolved', 'all') then
    raise exception 'Ungültiger Supportstatus';
  end if;

  return query
  select t.id, t.user_id, p.username, t.category, t.subject, t.status,
    t.created_at, t.updated_at, latest.body, latest.created_at
  from public.support_tickets t
  join public.profiles p on p.id = t.user_id
  left join lateral (
    select m.body, m.created_at
    from public.support_ticket_messages m
    where m.ticket_id = t.id
    order by m.created_at desc
    limit 1
  ) latest on true
  where p_status = 'all' or t.status = p_status
  order by t.updated_at desc
  limit 200;
end;
$$;

create or replace function public.support_list_ticket_messages(p_ticket_id uuid)
returns table (
  message_id uuid,
  sender_id uuid,
  sender_username text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Anmeldung erforderlich'; end if;
  if not exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket_id
      and (t.user_id = auth.uid() or public.is_site_admin(array['owner', 'admin']))
  ) then
    raise exception 'Supportanfrage nicht gefunden';
  end if;

  return query
  select m.id, m.sender_id, p.username, m.body, m.created_at
  from public.support_ticket_messages m
  join public.profiles p on p.id = m.sender_id
  where m.ticket_id = p_ticket_id
  order by m.created_at asc;
end;
$$;

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
  set updated_at = now(),
      status = case when v_is_admin then 'in_progress' else 'open' end
  where id = v_ticket.id;

  if v_is_admin then
    insert into public.admin_audit_log(actor_id, action, target_user_id, details)
    values (v_actor, 'support_reply_sent', v_ticket.user_id,
      jsonb_build_object('ticket_id', v_ticket.id));
  end if;
end;
$$;

create or replace function public.support_set_ticket_status(p_ticket_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_user_id uuid;
begin
  if not public.is_site_admin(array['owner', 'admin']) then
    raise exception using errcode = '42501', message = 'Keine Admin-Berechtigung';
  end if;
  if p_status is null or p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'Ungültiger Supportstatus';
  end if;

  update public.support_tickets
  set status = p_status, updated_at = now()
  where id = p_ticket_id
  returning user_id into v_user_id;
  if not found then raise exception 'Supportanfrage nicht gefunden'; end if;

  insert into public.admin_audit_log(actor_id, action, target_user_id, details)
  values (v_actor, 'support_ticket_status_changed', v_user_id,
    jsonb_build_object('ticket_id', p_ticket_id, 'status', p_status));
end;
$$;

revoke all on function public.support_create_ticket(text, text, text) from public, anon;
revoke all on function public.support_list_my_tickets() from public, anon;
revoke all on function public.admin_list_support_tickets(text) from public, anon;
revoke all on function public.support_list_ticket_messages(uuid) from public, anon;
revoke all on function public.support_reply(uuid, text) from public, anon;
revoke all on function public.support_set_ticket_status(uuid, text) from public, anon;

grant execute on function public.support_create_ticket(text, text, text) to authenticated;
grant execute on function public.support_list_my_tickets() to authenticated;
grant execute on function public.admin_list_support_tickets(text) to authenticated;
grant execute on function public.support_list_ticket_messages(uuid) to authenticated;
grant execute on function public.support_reply(uuid, text) to authenticated;
grant execute on function public.support_set_ticket_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
