-- 24. Batch-write 3D positions computed by the layout job. security invoker: RLS still applies to the caller.
create or replace function public.set_memory_positions(p_org uuid, p_items jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  update public.memories m
     set x = (i->>'x')::real, y = (i->>'y')::real, z = (i->>'z')::real
    from jsonb_array_elements(p_items) i
   where m.id = (i->>'id')::uuid and m.org_id = p_org;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.set_memory_positions to authenticated;

-- Memory text is searched by meaning (embedding) and also by content for the 3D view's filter.
create index if not exists memories_org_created on public.memories (org_id, created_at desc);
