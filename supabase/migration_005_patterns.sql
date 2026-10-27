-- 27. More shared injection patterns (the app also carries these as built-in defaults).
insert into public.injection_patterns (pattern, description)
select v.pattern, v.description from (values
  ('\b(call|invoke|run|execute|use)\s+(update_client|save_companies|save_search_zone|set_follow_up|log_interaction|add_lead|apply_search_tags|auto_tag_batch|plan_route|create_watcher|add_project|extract_projects|delete_\w+)\b', 'order to call an internal tool'),
  ('\b(when|if) you (call|use|run|invoke) [a-z_]{4,}.{0,80}(also|must|should)', 'fake tool rule'),
  ('(from|by) the (system )?(administrator|admin|developers?)|security audit.{0,120}(email|send|call|unlock)', 'fake authority'),
  ('copy .{0,60}(private|confidential|client records?).{0,80}(public|external|shared)', 'exfiltration by copying')
) as v(pattern, description)
where not exists (select 1 from public.injection_patterns p where p.description = v.description);
-- The role-label rule must also match after a sentence break, since pages are flattened to one line.
update public.injection_patterns set pattern = '(^|[\n.!?:>]\s*)(system|assistant|developer)\s*:' where description = 'fake role line';
