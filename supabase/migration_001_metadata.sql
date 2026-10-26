-- 22. Flexible per-row extras (the UI keeps a few free-form fields; typed columns stay the source of truth)
do $$
declare t text;
begin
  foreach t in array array['leads','enquiries','interactions','campaigns','campaign_targets','brands','products','push_logs','search_zones','routes']
  loop
    execute format('alter table public.%I add column if not exists metadata jsonb not null default ''{}''', t);
  end loop;
end $$;
