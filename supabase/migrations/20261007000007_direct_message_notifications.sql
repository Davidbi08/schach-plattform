create table if not exists public.direct_message_read_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default '-infinity'::timestamptz,
  primary key (user_id, friend_id),
  constraint direct_message_read_states_distinct_users check (user_id <> friend_id)
);

alter table public.direct_message_read_states enable row level security;
revoke all on public.direct_message_read_states from anon, authenticated;

create or replace function public.get_unread_direct_message_counts()
returns table (friend_id uuid, username text, unread_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.sender_id, p.username, count(*)::bigint
  from public.direct_messages m
  join public.profiles p on p.id = m.sender_id
  left join public.direct_message_read_states r
    on r.user_id = auth.uid() and r.friend_id = m.sender_id
  where auth.uid() is not null
    and m.recipient_id = auth.uid()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    and exists (
      select 1
      from public.friend_requests f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.recipient_id = m.sender_id)
          or (f.requester_id = m.sender_id and f.recipient_id = auth.uid()))
    )
  group by m.sender_id, p.username
  order by count(*) desc, p.username;
$$;

create or replace function public.mark_direct_messages_read(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  if not exists (
    select 1
    from public.friend_requests f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.recipient_id = p_other_user_id)
        or (f.requester_id = p_other_user_id and f.recipient_id = auth.uid()))
  ) then raise exception 'Private Nachrichten sind nur zwischen bestätigten Freunden möglich'; end if;

  insert into public.direct_message_read_states (user_id, friend_id, last_read_at)
  values (auth.uid(), p_other_user_id, now())
  on conflict (user_id, friend_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.get_unread_direct_message_counts() from public, anon;
revoke all on function public.mark_direct_messages_read(uuid) from public, anon;
grant execute on function public.get_unread_direct_message_counts() to authenticated;
grant execute on function public.mark_direct_messages_read(uuid) to authenticated;

notify pgrst, 'reload schema';
