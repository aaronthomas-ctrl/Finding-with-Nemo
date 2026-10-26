-- 23. Chat messages keep the events shown with them (tool calls, proposals, UI actions, cited memories)
alter table public.chat_messages add column if not exists metadata jsonb not null default '{}';
