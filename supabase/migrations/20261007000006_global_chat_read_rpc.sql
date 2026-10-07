create or replace function public.get_global_chat_messages()
returns table (id uuid, sender_id uuid, username text, avatar_url text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.sender_id, p.username, p.avatar_url,
    public.censor_chat_profanity(m.body), m.created_at
  from (
    select g.id, g.sender_id, g.body, g.created_at
    from public.global_chat_messages g
    where g.created_at >= date_trunc('week', now())
    order by g.created_at desc
    limit 100
  ) m
  join public.profiles p on p.id = m.sender_id
  where auth.uid() is not null
  order by m.created_at;
$$;

revoke all on function public.get_global_chat_messages() from public, anon;
grant execute on function public.get_global_chat_messages() to authenticated;

notify pgrst, 'reload schema';
