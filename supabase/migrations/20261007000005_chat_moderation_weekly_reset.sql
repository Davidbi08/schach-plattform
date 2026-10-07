create or replace function public.censor_chat_profanity(p_body text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_piece text;
  v_normalized text;
  v_result text := '';
begin
  if p_body is null then return null; end if;

  for v_piece in
    select (regexp_matches(p_body, '([[:space:]]+|[^[:space:]]+)', 'g'))[1]
  loop
    if v_piece ~ '^[[:space:]]+$' then
      v_result := v_result || v_piece;
      continue;
    end if;

    v_normalized := regexp_replace(
      translate(lower(v_piece), U&'\00E4\00F6\00FC\00DF013457@$!', 'aousoieastasi'),
      '[^[:alnum:]]',
      '',
      'g'
    );

    if v_normalized ~ '^(arsch|arschloch|arschgeige|arschkriecher|fick|fuck|fuk|fck|wichs|hurensohn|hure|huren|fotze|schlamp|nutte|scheiss|bastard|idiot|vollidiot|dummkopf|depp|trottel|mistgeburt|kack|spast|mongo|behindert|shit|bullshit|bitch|asshole|dick|cunt|motherfucker|dumbass|moron|retard)' then
      v_result := v_result || '[zensiert]';
    else
      v_result := v_result || v_piece;
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.censor_chat_profanity(text) from public, anon, authenticated;

create or replace function public.get_global_chat_messages()
returns table (id uuid, sender_id uuid, username text, avatar_url text, body text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_week_start timestamptz := date_trunc('week', now());
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;

  delete from public.global_chat_messages
  where created_at < v_week_start;

  return query
  select m.id, m.sender_id, p.username, p.avatar_url,
    public.censor_chat_profanity(m.body), m.created_at
  from (
    select g.id, g.sender_id, g.body, g.created_at
    from public.global_chat_messages g
    where g.created_at >= v_week_start
    order by g.created_at desc
    limit 100
  ) m
  join public.profiles p on p.id = m.sender_id
  order by m.created_at;
end;
$$;

create or replace function public.send_global_chat_message(p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_week_start timestamptz := date_trunc('week', now());
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'Nachrichten muessen 1 bis 500 Zeichen lang sein'; end if;

  delete from public.global_chat_messages
  where created_at < v_week_start;

  if (select count(*) from public.global_chat_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 15 then
    raise exception 'Du hast gerade viele Nachrichten gesendet. Bitte warte kurz.';
  end if;
  insert into public.global_chat_messages(sender_id, body)
  values (auth.uid(), public.censor_chat_profanity(trim(p_body)))
  returning id into v_id;
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
  ) then raise exception 'Private Nachrichten sind nur zwischen Freunden moeglich'; end if;
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
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if p_recipient_id = auth.uid() then raise exception 'Du kannst dir selbst keine Nachricht senden'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'Nachrichten muessen 1 bis 2.000 Zeichen lang sein'; end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.recipient_id = p_recipient_id)
        or (f.requester_id = p_recipient_id and f.recipient_id = auth.uid()))
  ) then raise exception 'Private Nachrichten sind nur zwischen Freunden moeglich'; end if;
  if (select count(*) from public.direct_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Du hast gerade viele Nachrichten gesendet. Bitte warte kurz.';
  end if;
  insert into public.direct_messages(sender_id, recipient_id, body)
  values (auth.uid(), p_recipient_id, public.censor_chat_profanity(trim(p_body)))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.get_global_chat_messages() from public;
revoke all on function public.send_global_chat_message(text) from public;
revoke all on function public.get_direct_messages(uuid) from public;
revoke all on function public.send_direct_message(uuid, text) from public;
grant execute on function public.get_global_chat_messages() to authenticated;
grant execute on function public.send_global_chat_message(text) to authenticated;
grant execute on function public.get_direct_messages(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
