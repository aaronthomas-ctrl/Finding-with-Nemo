-- =====================================================================
-- Prospecting Agent CRM: Supabase schema
-- Every data row carries org_id; RLS checks membership of that org.
-- Child rows use (parent_id, org_id) foreign keys so a row can never
-- point at another org's data.
-- =====================================================================

-- 1. Extensions
create extension if not exists vector   with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2. Types
create type public.org_kind     as enum ('business', 'personal');
create type public.org_role     as enum ('owner', 'admin', 'manager', 'sales', 'viewer');
create type public.review_state as enum ('pending', 'approved', 'rejected');

-- 3. Organisations, people, membership
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         public.org_kind not null default 'business',
  website      text,
  country      text,
  plan_limits  jsonb not null default
               '{"tokens_per_day": 2000000, "tavily_per_day": 100, "google_per_day": 500}',
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text,
  is_business      boolean,                      -- onboarding step 1 answer
  onboarding_step  smallint not null default 1,  -- 1 business?, 2 org+role, 3 profile/need, 4 done
  default_org_id   uuid references public.organizations (id) on delete set null,
  language         text default 'en',
  created_at       timestamptz not null default now()
);

create table public.memberships (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.org_role not null default 'sales',
  job_title   text,
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

create table public.org_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  role        public.org_role not null default 'sales' check (role <> 'owner'),
  expires_at  timestamptz not null default now() + interval '7 days',
  created_by  uuid references auth.users (id) on delete set null,
  used_by     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 4. Membership helpers (used by every policy)
create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = auth.uid());
$$;

create or replace function public.has_role(p_org uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = auth.uid()
                   and m.role = any (p_roles));
$$;

create or replace function public.can_write(p_org uuid)
returns boolean language sql stable as $$
  select public.has_role(p_org, array['owner','admin','manager','sales']::public.org_role[]);
$$;

create or replace function public.can_manage(p_org uuid)
returns boolean language sql stable as $$
  select public.has_role(p_org, array['owner','admin','manager']::public.org_role[]);
$$;

create or replace function public.is_admin(p_org uuid)
returns boolean language sql stable as $$
  select public.has_role(p_org, array['owner','admin']::public.org_role[]);
$$;

-- 5. Business profile and tags (replaces TAGS_MAP, PRODUCT_LINES, presets)
create table public.business_profiles (
  org_id            uuid primary key references public.organizations (id) on delete cascade,
  summary           text,
  looking_for       text,                        -- individual's stated need
  offerings         jsonb not null default '[]',
  target_customers  jsonb not null default '[]',
  config            jsonb not null default '{}', -- tier rules, categories, presets, cadence_days
  status            public.review_state not null default 'pending',
  approved_by       uuid references auth.users (id) on delete set null,
  approved_at       timestamptz,
  updated_at        timestamptz not null default now()
);

create table public.tag_definitions (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  name               text not null,
  description        text,
  keywords           text[] not null default '{}',
  negative_keywords  text[] not null default '{}',
  color              text not null default '#6b7280',
  origin             text not null default 'agent' check (origin in ('agent','user','seed')),
  status             public.review_state not null default 'pending',
  created_at         timestamptz not null default now(),
  unique (org_id, name)
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null,
  line         text,
  description  text,
  created_at   timestamptz not null default now(),
  unique (id, org_id)
);

create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  is_own      boolean not null default false,   -- false = competitor
  created_at  timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, name)
);

-- 6. Sources, evidence, facts (Evidence Gate)
create table public.sources (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  kind          text not null check (kind in ('web','tavily','google_places','voice_note','upload','user')),
  url           text,
  title         text,
  content       text,                  -- extracted text the quotes are checked against
  content_hash  text,
  fetched_at    timestamptz not null default now(),
  unique (id, org_id)
);
create index on public.sources (org_id, content_hash);

create table public.evidence (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  source_id  uuid not null,
  quote      text not null,
  verified   boolean not null default false,  -- set by code: quote found in sources.content
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (source_id, org_id) references public.sources (id, org_id) on delete cascade
);

-- 7. Prospecting
create table public.search_zones (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  tags        text[] not null default '{}',
  geometry    jsonb not null,   -- {"type":"polygon","path":[{lat,lng}...]} or {"type":"circle","center":{},"radius_m":n}
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (id, org_id)
);

create table public.search_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  zone_id       uuid,
  query         text not null,
  tags          text[] not null default '{}',
  result_count  integer,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (zone_id, org_id) references public.search_zones (id, org_id) on delete set null (zone_id)
);

create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  owner_id           uuid references auth.users (id) on delete set null,
  name               text not null,
  normalized_name    text,
  place_id           text,                     -- Google place_id: may be kept long term
  address            text,
  region             text,                     -- from geocoder, replaces extractEmirate
  lat                double precision,
  lng                double precision,
  geo_source         text check (geo_source in ('geocoding','places','user')),
  places_fetched_at  timestamptz,              -- Places lat/lng must be refreshed or cleared within 30 days
  website            text,
  phone_enc          text,                     -- AES-GCM ciphertext (base64), encrypted in server code
  email_enc          text,
  category           text,
  tags               text[] not null default '{}',
  tier               smallint check (tier between 1 and 4),
  status             text not null default 'new',
  is_watch           boolean not null default false,   -- was tier1.isWatch
  territory_status   text,                             -- was tier1.allocationStatus
  next_follow_up     date,
  last_contacted_at  timestamptz,
  retry_flag         boolean not null default false,
  metadata           jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, place_id)
);
create index on public.clients (org_id, next_follow_up);
create index on public.clients using gin (tags);

create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  client_id     uuid not null,
  name          text not null,
  job_title     text,
  phone_enc     text,
  email_enc     text,
  linkedin_url  text,               -- public profile URL only
  created_at    timestamptz not null default now(),
  unique (id, org_id),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);

create table public.facts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  client_id    uuid,
  project_id   uuid,               -- FK added after projects exists
  claim        text not null,
  evidence_id  uuid,
  status       text not null default 'unverified' check (status in ('verified','unverified','contradicted')),
  created_at   timestamptz not null default now(),
  unique (id, org_id),
  foreign key (client_id, org_id)   references public.clients (id, org_id) on delete cascade,
  foreign key (evidence_id, org_id) references public.evidence (id, org_id) on delete set null (evidence_id)
);

-- 8. Voice notes and interactions
create table public.voice_notes (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  client_id        uuid,
  user_id          uuid references auth.users (id) on delete set null,
  storage_path     text not null,          -- voice-notes/<org_id>/<uuid>.webm
  language         text,                   -- detected language code
  duration_s       integer,
  transcript_enc   text,                   -- original language, encrypted
  translation_enc  text,                   -- English, encrypted
  status           text not null default 'queued'
                   check (status in ('queued','transcribed','translated','extracted','failed')),
  error            text,
  created_at       timestamptz not null default now(),
  unique (id, org_id),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete set null (client_id)
);

create table public.interactions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  client_id      uuid not null,
  contact_id     uuid,
  user_id        uuid references auth.users (id) on delete set null,
  kind           text not null check (kind in ('call','visit','email','message','note','voice_note')),
  summary        text,
  voice_note_id  uuid,
  occurred_at    timestamptz not null default now(),
  foreign key (client_id, org_id)     references public.clients (id, org_id) on delete cascade,
  foreign key (contact_id, org_id)    references public.contacts (id, org_id) on delete set null (contact_id),
  foreign key (voice_note_id, org_id) references public.voice_notes (id, org_id) on delete set null (voice_note_id)
);
create index on public.interactions (org_id, client_id, occurred_at desc);

-- 9. Projects, cross-client links, predictions
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null,
  site         text,
  region       text,
  stage        text,
  starts_on    date,
  ends_on      date,
  description  text,
  created_at   timestamptz not null default now(),
  unique (id, org_id)
);

alter table public.facts
  add foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade;

create table public.project_participants (
  org_id      uuid not null,
  project_id  uuid not null,
  client_id   uuid not null,
  role        text,                 -- e.g. owner, main contractor, supplier
  primary key (project_id, client_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (client_id, org_id)  references public.clients (id, org_id) on delete cascade
);

create table public.link_proposals (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  project_id       uuid not null,
  client_id        uuid not null,
  role             text,
  reason           text not null,
  score            real check (score between 0 and 1),
  evidence_id      uuid,
  status           public.review_state not null default 'pending',
  decided_by       uuid references auth.users (id) on delete set null,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  foreign key (project_id, org_id)  references public.projects (id, org_id) on delete cascade,
  foreign key (client_id, org_id)   references public.clients (id, org_id) on delete cascade,
  foreign key (evidence_id, org_id) references public.evidence (id, org_id) on delete set null (evidence_id)
);

create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  client_id   uuid not null,
  product_id  uuid,
  owner_id    uuid references auth.users (id) on delete set null,
  title       text not null,
  value       numeric(14,2),
  currency    text default 'USD',
  stage       text not null default 'new',
  created_at  timestamptz not null default now(),
  unique (id, org_id),
  foreign key (client_id, org_id)  references public.clients (id, org_id) on delete cascade,
  foreign key (product_id, org_id) references public.products (id, org_id) on delete set null (product_id)
);

create table public.enquiries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  client_id    uuid not null,
  lead_id      uuid,
  product_id   uuid,
  details      text,
  quantity     numeric,
  status       text not null default 'open',
  received_at  timestamptz not null default now(),
  foreign key (client_id, org_id)  references public.clients (id, org_id) on delete cascade,
  foreign key (lead_id, org_id)    references public.leads (id, org_id) on delete set null (lead_id),
  foreign key (product_id, org_id) references public.products (id, org_id) on delete set null (product_id)
);

create table public.predictions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  client_id      uuid,
  project_id     uuid,
  product_id     uuid,
  need           text not null,
  expected_on    date,
  confidence     real check (confidence between 0 and 1),
  reasoning      text,
  evidence_ids   uuid[] not null default '{}',
  created_at     timestamptz not null default now(),
  foreign key (client_id, org_id)  references public.clients (id, org_id) on delete cascade,
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (product_id, org_id) references public.products (id, org_id) on delete set null (product_id)
);

-- 10. Routes
create table public.routes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  user_id           uuid references auth.users (id) on delete set null,
  name              text,
  plan_date         date not null default current_date,
  total_distance_m  integer,
  total_duration_s  integer,
  polyline          text,
  created_at        timestamptz not null default now(),
  unique (id, org_id)
);

create table public.route_stops (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  route_id        uuid not null,
  client_id       uuid not null,
  seq             smallint not null,
  leg_distance_m  integer,
  leg_duration_s  integer,
  unique (route_id, seq),
  foreign key (route_id, org_id)  references public.routes (id, org_id) on delete cascade,
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);

-- 11. Campaigns
create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  product_id  uuid,
  brand_id    uuid,
  starts_on   date,
  ends_on     date,
  status      text not null default 'draft',
  pitch       text,
  created_at  timestamptz not null default now(),
  unique (id, org_id),
  foreign key (product_id, org_id) references public.products (id, org_id) on delete set null (product_id),
  foreign key (brand_id, org_id)   references public.brands (id, org_id)   on delete set null (brand_id)
);

create table public.campaign_targets (
  org_id       uuid not null,
  campaign_id  uuid not null,
  client_id    uuid not null,
  status       text not null default 'planned',
  primary key (campaign_id, client_id),
  foreign key (campaign_id, org_id) references public.campaigns (id, org_id) on delete cascade,
  foreign key (client_id, org_id)   references public.clients (id, org_id)   on delete cascade
);

create table public.push_logs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  campaign_id  uuid,
  client_id    uuid not null,
  user_id      uuid references auth.users (id) on delete set null,
  channel      text,
  note         text,
  pushed_at    timestamptz not null default now(),
  foreign key (campaign_id, org_id) references public.campaigns (id, org_id) on delete set null (campaign_id),
  foreign key (client_id, org_id)   references public.clients (id, org_id)   on delete cascade
);
create index on public.push_logs (org_id, client_id, pushed_at desc);

-- 12. Memory (vectors + 3D positions)
-- Set the vector size to your embedding model's output size.
-- HNSW indexes accept up to 2000 dimensions.
create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  kind        text not null check (kind in ('fact','interaction','voice','profile','project','prediction','web','chat')),
  content     text not null,
  embedding   extensions.vector(1024),
  color       text,
  x           real, y real, z real,            -- 3D position written by the UMAP job
  fact_id     uuid,
  source_id   uuid,
  client_id   uuid,
  project_id  uuid,
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, org_id),
  foreign key (fact_id, org_id)    references public.facts (id, org_id)    on delete cascade,
  foreign key (source_id, org_id)  references public.sources (id, org_id)  on delete set null (source_id),
  foreign key (client_id, org_id)  references public.clients (id, org_id)  on delete cascade,
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index on public.memories using hnsw (embedding extensions.vector_cosine_ops);
create index on public.memories (org_id, kind);

create table public.memory_links (
  org_id    uuid not null,
  from_id   uuid not null,
  to_id     uuid not null,
  relation  text not null,       -- same_client, same_project, mentions, contradicts
  weight    real not null default 1,
  primary key (from_id, to_id, relation),
  check (from_id <> to_id),
  foreign key (from_id, org_id) references public.memories (id, org_id) on delete cascade,
  foreign key (to_id, org_id)   references public.memories (id, org_id) on delete cascade
);

-- 13. Chat and agent
create table public.chat_threads (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  unique (id, org_id)
);

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  thread_id   uuid not null,
  role        text not null check (role in ('user','assistant','tool')),
  content     text not null,
  tool_name   text,
  created_at  timestamptz not null default now(),
  unique (id, org_id),
  foreign key (thread_id, org_id) references public.chat_threads (id, org_id) on delete cascade
);
create index on public.chat_messages (thread_id, created_at);

create table public.message_memory_refs (
  org_id      uuid not null,
  message_id  uuid not null,
  memory_id   uuid not null,
  primary key (message_id, memory_id),
  foreign key (message_id, org_id) references public.chat_messages (id, org_id) on delete cascade,
  foreign key (memory_id, org_id)  references public.memories (id, org_id)      on delete cascade
);

create table public.agent_runs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  thread_id   uuid,
  user_id     uuid references auth.users (id) on delete set null,
  model       text not null,
  status      text not null default 'running' check (status in ('running','done','failed','stopped')),
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  unique (id, org_id),
  foreign key (thread_id, org_id) references public.chat_threads (id, org_id) on delete set null (thread_id)
);

create table public.approvals (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  run_id        uuid,
  tool          text not null,
  proposal      jsonb not null,
  status        public.review_state not null default 'pending',
  requested_by  uuid references auth.users (id) on delete set null,
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (id, org_id),
  foreign key (run_id, org_id) references public.agent_runs (id, org_id) on delete set null (run_id)
);

create table public.agent_tool_calls (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  run_id       uuid not null,
  tool         text not null,
  args         jsonb not null default '{}',
  result       jsonb,
  is_write     boolean not null default false,
  approval_id  uuid,
  blocked      boolean not null default false,   -- stopped by injection or safety check
  created_at   timestamptz not null default now(),
  foreign key (run_id, org_id)      references public.agent_runs (id, org_id) on delete cascade,
  foreign key (approval_id, org_id) references public.approvals (id, org_id)  on delete set null (approval_id)
);

-- 14. Watchers and in-app notifications
create table public.watchers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  client_id    uuid,
  created_by   uuid references auth.users (id) on delete set null,
  kind         text not null check (kind in ('website','social','news','projects')),
  target       text not null,                -- URL or search query
  every        text not null default 'daily' check (every in ('daily','weekly')),
  last_hash    text,
  last_run_at  timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, org_id),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);

create table public.watcher_runs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  watcher_id  uuid not null,
  status      text not null check (status in ('ok','changed','failed')),
  summary     text,
  source_id   uuid,
  started_at  timestamptz not null default now(),
  foreign key (watcher_id, org_id) references public.watchers (id, org_id) on delete cascade,
  foreign key (source_id, org_id)  references public.sources (id, org_id)  on delete set null (source_id)
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,  -- null = every member
  kind        text not null,
  title       text not null,
  body        text,
  link        text,           -- in-app route, e.g. /pipeline/<id>
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notifications (org_id, user_id, read_at);

-- 15. Audit, usage, shared reference data
create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   uuid,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.usage_quota (
  org_id          uuid not null references public.organizations (id) on delete cascade,
  day             date not null default current_date,
  tokens_in       bigint  not null default 0,
  tokens_out      bigint  not null default 0,
  tavily_credits  integer not null default 0,
  google_calls    integer not null default 0,
  primary key (org_id, day)
);

create table public.injection_patterns (     -- global, read-only for users
  id           serial primary key,
  pattern      text not null,                -- regular expression
  description  text not null
);

-- 16. Functions called by the app
-- Onboarding: create an org and make the caller its owner.
create or replace function public.create_organization(
  p_name text, p_kind public.org_kind, p_website text default null, p_country text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.organizations (name, kind, website, country, created_by)
  values (p_name, p_kind, p_website, p_country, auth.uid()) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into public.business_profiles (org_id) values (v_org);
  update public.profiles
     set default_org_id = v_org, is_business = (p_kind = 'business'), onboarding_step = 3
   where id = auth.uid();
  return v_org;
end $$;

-- Onboarding: join a business with an invite code.
create or replace function public.join_organization(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.org_invites;
begin
  select * into v_inv from public.org_invites
   where code = p_code and used_by is null and expires_at > now() for update;
  if not found then raise exception 'invite not valid'; end if;
  insert into public.memberships (org_id, user_id, role, invited_by)
  values (v_inv.org_id, auth.uid(), v_inv.role, v_inv.created_by)
  on conflict do nothing;
  update public.org_invites set used_by = auth.uid() where id = v_inv.id;
  update public.profiles
     set default_org_id = v_inv.org_id, is_business = true, onboarding_step = 4
   where id = auth.uid();
  return v_inv.org_id;
end $$;

-- Memory search. security invoker: RLS still applies to the caller.
create or replace function public.match_memories(
  p_org uuid, p_embedding extensions.vector(1024), p_count int default 12)
returns table (id uuid, kind text, content text, similarity real)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.kind, m.content,
         (1 - (m.embedding operator(extensions.<=>) p_embedding))::real
    from public.memories m
   where m.org_id = p_org and m.embedding is not null
   order by m.embedding operator(extensions.<=>) p_embedding
   limit least(p_count, 50);
$$;

-- Usage counter. Values must be positive, so a user cannot lower their own usage.
create or replace function public.add_usage(
  p_org uuid, p_tokens_in int default 0, p_tokens_out int default 0,
  p_tavily int default 0, p_google int default 0)
returns public.usage_quota language plpgsql security definer set search_path = '' as $$
declare v_row public.usage_quota;
begin
  if not public.is_member(p_org) then raise exception 'not a member'; end if;
  if least(p_tokens_in, p_tokens_out, p_tavily, p_google) < 0 then
    raise exception 'usage must be positive';
  end if;
  insert into public.usage_quota as u (org_id, day, tokens_in, tokens_out, tavily_credits, google_calls)
  values (p_org, current_date, p_tokens_in, p_tokens_out, p_tavily, p_google)
  on conflict (org_id, day) do update
     set tokens_in      = u.tokens_in + excluded.tokens_in,
         tokens_out     = u.tokens_out + excluded.tokens_out,
         tavily_credits = u.tavily_credits + excluded.tavily_credits,
         google_calls   = u.google_calls + excluded.google_calls
  returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.create_organization, public.join_organization,
                          public.add_usage from anon, public;
grant  execute on function public.create_organization, public.join_organization,
                          public.add_usage, public.match_memories to authenticated;

-- 17. Triggers
-- New sign-up -> profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger business_profiles_touch before update on public.business_profiles
  for each row execute function public.touch_updated_at();

-- Never let a membership change remove the last owner.
create or replace function public.keep_one_owner()
returns trigger language plpgsql as $$
begin
  -- allow cascades when the org or the user itself is being deleted
  if not exists (select 1 from public.organizations where id = old.org_id)
     or not exists (select 1 from auth.users where id = old.user_id) then
    return coalesce(new, old);
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from public.memberships
                     where org_id = old.org_id and role = 'owner' and user_id <> old.user_id) then
    raise exception 'an organisation needs at least one owner';
  end if;
  return coalesce(new, old);
end $$;

create trigger memberships_keep_owner before update or delete on public.memberships
  for each row execute function public.keep_one_owner();

-- 18. Row Level Security
-- 18a. Standard org tables: members read; owner/admin/manager/sales write;
--      owner/admin/manager delete; viewers read only.
do $$
declare t text;
begin
  foreach t in array array[
    'tag_definitions','products','brands','sources','evidence','facts',
    'search_zones','search_runs','clients','contacts','voice_notes','interactions',
    'projects','project_participants','link_proposals','leads','enquiries','predictions',
    'routes','route_stops','campaigns','campaign_targets','push_logs',
    'memories','memory_links','agent_runs','approvals','agent_tool_calls',
    'watchers','watcher_runs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s read"   on public.%1$I for select to authenticated using (public.is_member(org_id))', t);
    execute format('create policy "%1$s insert" on public.%1$I for insert to authenticated with check (public.can_write(org_id))', t);
    execute format('create policy "%1$s update" on public.%1$I for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id))', t);
    execute format('create policy "%1$s delete" on public.%1$I for delete to authenticated using (public.can_manage(org_id))', t);
  end loop;
end $$;

-- Viewers can still chat, so any member may log agent runs and tool calls.
create policy "runs log"  on public.agent_runs       for insert to authenticated with check (public.is_member(org_id));
create policy "calls log" on public.agent_tool_calls for insert to authenticated with check (public.is_member(org_id));

-- 18b. Organisations: members read; owner/admin edit; created only through create_organization().
alter table public.organizations enable row level security;
create policy "org read"   on public.organizations for select to authenticated using (public.is_member(id));
create policy "org update" on public.organizations for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- 18c. Profiles: each user sees and edits only their own row; members see teammates' names.
alter table public.profiles enable row level security;
create policy "profile self"  on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profile team"  on public.profiles for select to authenticated
  using (exists (select 1 from public.memberships a join public.memberships b using (org_id)
                 where a.user_id = auth.uid() and b.user_id = profiles.id));

-- 18d. Memberships and invites: members read; owner/admin manage.
alter table public.memberships enable row level security;
create policy "members read"   on public.memberships for select to authenticated using (public.is_member(org_id));
create policy "members manage" on public.memberships for all to authenticated
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

alter table public.org_invites enable row level security;
create policy "invites manage" on public.org_invites for all to authenticated
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

-- 18e. Business profile: members read; owner/admin/manager edit.
alter table public.business_profiles enable row level security;
create policy "bp read"  on public.business_profiles for select to authenticated using (public.is_member(org_id));
create policy "bp write" on public.business_profiles for update to authenticated
  using (public.can_manage(org_id)) with check (public.can_manage(org_id));

-- 18f. Chat is private to its author inside the org.
alter table public.chat_threads enable row level security;
create policy "threads own" on public.chat_threads for all to authenticated
  using (user_id = auth.uid() and public.is_member(org_id))
  with check (user_id = auth.uid() and public.is_member(org_id));

alter table public.chat_messages enable row level security;
create policy "messages own" on public.chat_messages for all to authenticated
  using (exists (select 1 from public.chat_threads t where t.id = thread_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.chat_threads t where t.id = thread_id and t.user_id = auth.uid()));

alter table public.message_memory_refs enable row level security;
create policy "refs own" on public.message_memory_refs for all to authenticated
  using (exists (select 1 from public.chat_messages m join public.chat_threads t on t.id = m.thread_id
                 where m.id = message_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.chat_messages m join public.chat_threads t on t.id = m.thread_id
                      where m.id = message_id and t.user_id = auth.uid()));

-- 18g. Notifications: yours, or org-wide ones; you may only mark them read.
alter table public.notifications enable row level security;
create policy "notif read" on public.notifications for select to authenticated
  using (public.is_member(org_id) and (user_id is null or user_id = auth.uid()));
create policy "notif mark" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 18h. Audit log: members append and read; nobody edits or deletes.
alter table public.audit_log enable row level security;
create policy "audit read"   on public.audit_log for select to authenticated using (public.is_member(org_id));
create policy "audit insert" on public.audit_log for insert to authenticated
  with check (public.is_member(org_id) and actor_id = auth.uid());

-- 18i. Usage: members read; writes only through add_usage().
alter table public.usage_quota enable row level security;
create policy "usage read" on public.usage_quota for select to authenticated using (public.is_member(org_id));

-- 18j. Injection patterns: everyone signed in reads; only the service role writes.
alter table public.injection_patterns enable row level security;
create policy "patterns read" on public.injection_patterns for select to authenticated using (true);

-- Column-level guard: notifications may only change read_at.
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;

-- 19. Storage: private buckets, files under <org_id>/...
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false), ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "org files read" on storage.objects for select to authenticated
  using (bucket_id in ('voice-notes','uploads')
         and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "org files insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('voice-notes','uploads')
              and public.can_write(((storage.foldername(name))[1])::uuid));
create policy "org files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('voice-notes','uploads')
         and public.can_manage(((storage.foldername(name))[1])::uuid));

-- 20. Realtime for the in-app notification bell
alter publication supabase_realtime add table public.notifications;

-- 21. Seed: prompt-injection patterns (shared, read-only for users)
insert into public.injection_patterns (pattern, description) values
 ('ignore (all |any )?(previous|prior|above) (instructions|rules|prompts)', 'direct override'),
 ('(^|\n)\s*(system|assistant|developer)\s*:', 'fake role line'),
 ('</?(system|tool_result|instructions|untrusted)>', 'fake tags'),
 ('you are now|new instructions|act as (an? )?(admin|developer|system)', 'role change'),
 ('!\[[^\]]*\]\(https?://', 'markdown image link'),
 ('(decode|base64|rot13).{0,40}(follow|execute|run)', 'encoded payload'),
 ('(send|email|post|upload).{0,40}(client list|contacts|api key|password)', 'data exfiltration ask'),
 ('remember (that|this)|save (this|that) (to|in) memory', 'memory poisoning');
-- 22. Flexible per-row extras (the UI keeps a few free-form fields; typed columns stay the source of truth)
do $$
declare t text;
begin
  foreach t in array array['leads','enquiries','interactions','campaigns','campaign_targets','brands','products','push_logs','search_zones','routes']
  loop
    execute format('alter table public.%I add column if not exists metadata jsonb not null default ''{}''', t);
  end loop;
end $$;
-- 23. Chat messages keep the events shown with them (tool calls, proposals, UI actions, cited memories)
alter table public.chat_messages add column if not exists metadata jsonb not null default '{}';
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
