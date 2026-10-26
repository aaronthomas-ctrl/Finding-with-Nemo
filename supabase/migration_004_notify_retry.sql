-- 25. In-app notifications. Members may notify a teammate in their own org; nothing else can insert.
create or replace function public.notify(
  p_org uuid, p_user uuid, p_kind text, p_title text, p_body text default null, p_link text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not public.is_member(p_org) then raise exception 'not a member'; end if;
  if p_user is not null and not exists (
       select 1 from public.memberships m where m.org_id = p_org and m.user_id = p_user) then
    raise exception 'recipient is not in this organisation';
  end if;
  insert into public.notifications (org_id, user_id, kind, title, body, link)
  values (p_org, p_user, p_kind, left(p_title, 200), left(p_body, 1000), p_link) returning id into v;
  return v;
end $$;
revoke execute on function public.notify from anon, public;
grant  execute on function public.notify to authenticated;

-- 26. Retry flag: the last touch was an outreach (email or message) 3 or more days ago with no reply logged since.
create or replace function public.sweep_retry_flags(p_org uuid)
returns integer language sql security invoker set search_path = '' as $$
  with last as (
    select distinct on (client_id) client_id, kind, occurred_at
      from public.interactions where org_id = p_org order by client_id, occurred_at desc),
  want as (
    select c.id, coalesce(l.kind in ('email','message') and l.occurred_at <= now() - interval '3 days', false) as flag
      from public.clients c left join last l on l.client_id = c.id where c.org_id = p_org),
  upd as (
    update public.clients c set retry_flag = w.flag from want w
     where c.id = w.id and c.org_id = p_org and c.retry_flag is distinct from w.flag returning 1)
  select count(*)::int from upd;
$$;
grant execute on function public.sweep_retry_flags to authenticated;
