-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update Trigger Function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TABLES --

-- settings
CREATE TABLE IF NOT EXISTS settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  cadence_days JSONB DEFAULT '{"1": 7, "2": 14, "3": 30, "4": 30}',
  templates JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_settings_updated_at ON settings;
CREATE TRIGGER set_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  phone TEXT,
  email TEXT,
  website TEXT,
  background_blurb TEXT,
  category TEXT CHECK (category IN (
    'EPC Contractor', 'Steel Fabricator', 'Oilfield & Petrochemical Services',
    'Electromechanical', 'MEP', 'Marine/Shipbuilding', 'Welding Trade',
    'Distributor', 'Trader', 'Other'
  )),
  tier SMALLINT CHECK (tier BETWEEN 1 AND 4),
  status TEXT CHECK (status IN ('New', 'Pursuing', 'Quoted', 'Won', 'Lost', 'Parked')),
  what_they_do TEXT,
  next_follow_up_date DATE,
  retry_flag BOOLEAN DEFAULT false,
  name_normalized TEXT GENERATED ALWAYS AS (
    upper(regexp_replace(regexp_replace(name, '(?i)\s+(LLC|FZE|FZC|LTD|CO)\.?$', ''), '[[:punct:]]', '', 'g'))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

DROP TRIGGER IF EXISTS set_clients_updated_at ON clients;
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- client_contacts
CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  mobile TEXT,
  email TEXT
);

-- leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  note TEXT,
  product_line TEXT CHECK (product_line IN (
    'ESAB Machines', 'ESAB Consumables', 'EWM Machines', 'Callington',
    'CNC', 'Automated', 'AMC', 'Service', 'Grindex', 'SPX', 'Victor'
  )),
  est_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- enquiries
CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  enquiry_date DATE NOT NULL,
  product_line TEXT CHECK (product_line IN (
    'ESAB Machines', 'ESAB Consumables', 'EWM Machines', 'Callington',
    'CNC', 'Automated', 'AMC', 'Service', 'Grindex', 'SPX', 'Victor'
  )),
  item_description TEXT,
  quantity NUMERIC,
  department TEXT,
  outcome TEXT CHECK (outcome IN ('Quoted', 'Ordered', 'Lost', 'Pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_enquiries_updated_at ON enquiries;
CREATE TRIGGER set_enquiries_updated_at
  BEFORE UPDATE ON enquiries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- interactions
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('WhatsApp', 'Email', 'LinkedIn', 'Call', 'Visit', 'Note')),
  summary TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  product_lines TEXT[],
  offer_details TEXT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- campaign_targets
CREATE TABLE IF NOT EXISTS campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  state TEXT CHECK (state IN ('Pending', 'Sent', 'Responded', 'Converted')) DEFAULT 'Pending',
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  UNIQUE(campaign_id, client_id)
);


-- INDEXES --
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_tier ON clients(tier);
CREATE INDEX IF NOT EXISTS idx_clients_next_follow_up_date ON clients(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_clients_name_normalized ON clients(name_normalized);

CREATE INDEX IF NOT EXISTS idx_enquiries_composite ON enquiries(client_id, product_line, enquiry_date);
CREATE INDEX IF NOT EXISTS idx_interactions_composite ON interactions(client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_composite ON campaign_targets(campaign_id, state);


-- RLS --
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_targets ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['settings', 'clients', 'client_contacts', 'leads', 'enquiries', 'interactions', 'campaigns', 'campaign_targets'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon full access" ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access" ON %I;', t);
    EXECUTE format('-- anon denied', t);
    EXECUTE format('CREATE POLICY "Allow authenticated full access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;


-- VIEWS --

-- 1. v_enquiry_forecast
DROP VIEW IF EXISTS v_predicted_demand_30d;
DROP VIEW IF EXISTS v_enquiry_forecast;
CREATE OR REPLACE VIEW v_enquiry_forecast AS
WITH base_data AS (
  SELECT 
    client_id, 
    product_line, 
    COALESCE(department, '') AS department,
    enquiry_date,
    lag(enquiry_date) OVER (PARTITION BY client_id, product_line, COALESCE(department, '') ORDER BY enquiry_date) as prev_date
  FROM enquiries
),
intervals AS (
  SELECT 
    client_id,
    product_line,
    department,
    enquiry_date,
    (enquiry_date - prev_date) AS gap_days
  FROM base_data
),
stats AS (
  SELECT 
    client_id,
    product_line,
    department,
    COUNT(*) AS enquiry_count,
    MAX(enquiry_date) AS last_enquiry_date,
    AVG(gap_days) AS avg_interval_days,
    STDDEV(gap_days) AS stddev_interval_days
  FROM intervals
  GROUP BY client_id, product_line, department
  HAVING COUNT(*) >= 2
)
SELECT 
  client_id,
  product_line,
  NULLIF(department, '') AS department,
  enquiry_count,
  last_enquiry_date,
  avg_interval_days,
  stddev_interval_days,
  last_enquiry_date + avg_interval_days::integer AS predicted_next_date,
  CASE 
    WHEN enquiry_count = 2 THEN 'Low'
    WHEN (stddev_interval_days / NULLIF(avg_interval_days, 0)) < 0.25 THEN 'High'
    WHEN (stddev_interval_days / NULLIF(avg_interval_days, 0)) <= 0.5 THEN 'Medium'
    ELSE 'Low'
  END AS confidence
FROM stats;

-- 2. v_predicted_demand_30d
CREATE OR REPLACE VIEW v_predicted_demand_30d AS
SELECT 
  f.*,
  c.name AS client_name,
  c.tier AS client_tier,
  c.category AS client_category
FROM v_enquiry_forecast f
JOIN clients c ON f.client_id = c.id
WHERE (f.last_enquiry_date + f.avg_interval_days::integer) BETWEEN CURRENT_DATE - 15 AND CURRENT_DATE + 30
ORDER BY f.predicted_next_date ASC;

-- 3. v_due_today
DROP VIEW IF EXISTS v_due_today;
CREATE OR REPLACE VIEW v_due_today AS
SELECT 
  *,
  CURRENT_DATE - next_follow_up_date AS days_overdue
FROM clients
WHERE next_follow_up_date <= CURRENT_DATE
ORDER BY (CURRENT_DATE - next_follow_up_date) DESC;

-- 4. v_retry_candidates
DROP VIEW IF EXISTS v_retry_candidates;
CREATE OR REPLACE VIEW v_retry_candidates AS
WITH ranked_interactions AS (
  SELECT 
    client_id, channel, occurred_at,
    ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY occurred_at DESC) as rn
  FROM interactions
)
SELECT c.* 
FROM clients c
JOIN ranked_interactions ri ON c.id = ri.client_id AND ri.rn = 1
WHERE ri.channel IN ('WhatsApp', 'Email', 'LinkedIn')
  AND ri.occurred_at <= NOW() - INTERVAL '3 days';

-- 5. v_going_cold
DROP VIEW IF EXISTS v_going_cold;
CREATE OR REPLACE VIEW v_going_cold AS
WITH last_inter AS (
  SELECT 
    c.id AS client_id,
    c.tier,
    c.next_follow_up_date,
    c.created_at,
    MAX(i.occurred_at) AS last_interaction_at
  FROM clients c
  LEFT JOIN interactions i ON c.id = i.client_id
  GROUP BY c.id, c.tier, c.next_follow_up_date, c.created_at
),
cadences AS (
  SELECT 
    cadence_days->>'1' AS tier1,
    cadence_days->>'2' AS tier2,
    cadence_days->>'3' AS tier3,
    cadence_days->>'4' AS tier4
  FROM settings
  LIMIT 1
)
SELECT 
  l.client_id,
  COALESCE(l.last_interaction_at, l.created_at) AS ref_date,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(l.last_interaction_at, l.created_at))) / 86400 AS days_since,
  CASE l.tier 
    WHEN 1 THEN (SELECT tier1::numeric FROM cadences)
    WHEN 2 THEN (SELECT tier2::numeric FROM cadences)
    WHEN 3 THEN (SELECT tier3::numeric FROM cadences)
    WHEN 4 THEN (SELECT tier4::numeric FROM cadences)
    ELSE 30
  END AS cadence_days,
  ((EXTRACT(EPOCH FROM (NOW() - COALESCE(l.last_interaction_at, l.created_at))) / 86400) / 
  NULLIF(
    CASE l.tier 
      WHEN 1 THEN (SELECT tier1::numeric FROM cadences)
      WHEN 2 THEN (SELECT tier2::numeric FROM cadences)
      WHEN 3 THEN (SELECT tier3::numeric FROM cadences)
      WHEN 4 THEN (SELECT tier4::numeric FROM cadences)
      ELSE 30
    END, 0
  )) * CASE l.tier 
      WHEN 1 THEN 3
      WHEN 2 THEN 2
      WHEN 3 THEN 1.2
      WHEN 4 THEN 1
      ELSE 1
    END AS cold_score
FROM last_inter l
WHERE l.next_follow_up_date IS NULL
  AND (EXTRACT(EPOCH FROM (NOW() - COALESCE(l.last_interaction_at, l.created_at))) / 86400) > 
  CASE l.tier 
    WHEN 1 THEN (SELECT tier1::numeric FROM cadences)
    WHEN 2 THEN (SELECT tier2::numeric FROM cadences)
    WHEN 3 THEN (SELECT tier3::numeric FROM cadences)
    WHEN 4 THEN (SELECT tier4::numeric FROM cadences)
    ELSE 30
  END
ORDER BY cold_score DESC;


-- FUNCTIONS --
CREATE OR REPLACE FUNCTION log_interaction_and_clear_retry(
  p_client_id UUID, 
  p_channel TEXT, 
  p_summary TEXT,
  p_created_by UUID DEFAULT NULL
) RETURNS interactions AS $$
DECLARE
  v_interaction interactions;
BEGIN
  INSERT INTO interactions (client_id, channel, summary, created_by)
  VALUES (p_client_id, p_channel, p_summary, p_created_by)
  RETURNING * INTO v_interaction;

  UPDATE clients 
  SET retry_flag = false
  WHERE id = p_client_id;

  RETURN v_interaction;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upsert_follow_up(
  p_client_id UUID,
  p_date DATE
) RETURNS void AS $$
BEGIN
  UPDATE clients
  SET next_follow_up_date = p_date
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;


-- SEED DATA --
INSERT INTO settings (id, cadence_days, templates)
VALUES (
  1,
  '{"1":7,"2":14,"3":30,"4":30}'::jsonb,
  '{
    "firstOutreach": {
      "WhatsApp": "Hi {contact_name}, this is regarding {company}. We offer {product_line} and currently have {offer}.",
      "Email": {
        "subject": "Introduction to {company}",
        "body": "Hi {contact_name},\n\nWe provide {product_line} and can help {company} with {offer}.\n\nBest,\nTeam"
      },
      "LinkedIn": "Hi {contact_name}, let''s connect. I work with {company}."
    },
    "followUp": {
      "WhatsApp": "Hi {contact_name}, following up on {company}. Any updates on {product_line}?",
      "Email": {
        "subject": "Follow up for {company}",
        "body": "Hi {contact_name},\n\nFollowing up on {product_line}.\n\nBest,\nTeam"
      },
      "LinkedIn": "Hi {contact_name}, following up on my previous message."
    },
    "campaign": {
      "WhatsApp": "Hi {contact_name}, special {offer} for {company} on {product_line}.",
      "Email": {
        "subject": "Special Offer for {company}",
        "body": "Hi {contact_name},\n\nSpecial {offer} on {product_line}.\n\nBest,\nTeam"
      },
      "LinkedIn": "Hi {contact_name}, special {offer}."
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;


-- MIGRATION: BRAND CAMPAIGNS, PRODUCT PROFILES, PREDICTED DEMAND, PIPELINE LINKING --

-- 1. Modify Clients Table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_maps_link TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_tags TEXT[];

-- Update category check constraint to allow more categories if needed, or we just drop the check constraint and recreate it or leave it as is if it fits.
-- Dropping the constraint is safer if they add dynamic ones.
DO $$ 
BEGIN
  ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_category_check;
EXCEPTION
  WHEN undefined_object THEN
    -- Do nothing
END $$;

-- 2. Brands
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL,
  brand_logo TEXT,
  brand_description TEXT,
  brand_website TEXT,
  product_categories TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_brands_updated_at ON brands;
CREATE TRIGGER set_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 3. Product Profiles
CREATE TABLE IF NOT EXISTS product_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  product_category TEXT,
  product_name TEXT NOT NULL,
  product_type TEXT CHECK (product_type IN ('MACHINE', 'CONSUMABLE', 'TORCH', 'SPARE_PART', 'ACCESSORY')),
  fact_sheet_file TEXT,
  extracted_specs JSONB,
  product_images TEXT[],
  linked_consumables UUID[], -- array of product_profile IDs
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_product_profiles_updated_at ON product_profiles;
CREATE TRIGGER set_product_profiles_updated_at BEFORE UPDATE ON product_profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 4. Campaign Creatives
CREATE TABLE IF NOT EXISTS campaign_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  linked_product_ids UUID[], -- array of product_profile IDs
  html_file TEXT,
  body_text_variant TEXT,
  subject_line TEXT,
  image_hosting_urls TEXT[],
  status TEXT CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')) DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_campaign_creatives_updated_at ON campaign_creatives;
CREATE TRIGGER set_campaign_creatives_updated_at BEFORE UPDATE ON campaign_creatives FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Add campaign_creative_id to campaign_targets if we are replacing campaigns with campaign_creatives
ALTER TABLE campaign_targets ADD COLUMN IF NOT EXISTS campaign_creative_id UUID REFERENCES campaign_creatives(id) ON DELETE CASCADE;

-- 5. Activity Events (for Predicted Demand)
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT CHECK (event_type IN ('CUSTOMER_VIEWED', 'BRAND_VIEWED', 'PRODUCT_PROFILE_VIEWED', 'CATEGORY_SEARCHED', 'CAMPAIGN_VIEWED')),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  product_id UUID REFERENCES product_profiles(id) ON DELETE CASCADE,
  category TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "user" TEXT
);

-- 6. Add linking to leads/pipeline
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linked_campaign_id UUID REFERENCES campaign_creatives(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linked_product_ids UUID[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- 7. Add response_deadline to campaign_targets if not exists
ALTER TABLE campaign_targets ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMPTZ;

-- Recreate Views with activity logic
-- We will add this to the app logic or DB views later.

-- RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['brands', 'product_profiles', 'campaign_creatives', 'activity_events'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon full access" ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access" ON %I;', t);
    EXECUTE format('-- anon denied', t);
    EXECUTE format('CREATE POLICY "Allow authenticated full access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
