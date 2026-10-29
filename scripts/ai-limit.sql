-- Hard per-user cap on AI requests (free judge access). One request = one chat message, enrichment, pitch, insight or similar.
create table if not exists public.user_ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calls int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.user_ai_usage enable row level security;
drop policy if exists "own ai usage" on public.user_ai_usage;
create policy "own ai usage" on public.user_ai_usage for select to authenticated using (user_id = auth.uid());

create or replace function public.consume_ai_call(p_limit int)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.user_ai_usage as u (user_id, calls) values (auth.uid(), 1)
  on conflict (user_id) do update set calls = u.calls + 1, updated_at = now() where u.calls < p_limit
  returning calls into n;
  if n is null then raise exception 'ai_limit_reached'; end if;
  return n;
end $$;
revoke execute on function public.consume_ai_call from anon, public;
grant execute on function public.consume_ai_call to authenticated;
