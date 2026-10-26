-- Supabase Schema for B2B Sales DB

CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  phone TEXT,
  website TEXT,
  "backgroundBlurb" TEXT,
  category TEXT,
  tier INTEGER,
  status TEXT,
  "whatTheyDo" TEXT,
  contacts JSONB,
  "nextFollowUpDate" TIMESTAMP WITH TIME ZONE,
  "retryFlag" BOOLEAN,
  tier1 JSONB,
  "restrictedBrands" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY,
  "clientId" UUID REFERENCES clients(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE,
  note TEXT,
  "productLine" TEXT,
  "estValue" DOUBLE PRECISION
);

CREATE TABLE enquiries (
  id UUID PRIMARY KEY,
  "clientId" UUID REFERENCES clients(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE,
  "productLine" TEXT,
  "itemDescription" TEXT,
  quantity INTEGER,
  department TEXT,
  outcome TEXT
);

CREATE TABLE interactions (
  id UUID PRIMARY KEY,
  "clientId" UUID REFERENCES clients(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE,
  channel TEXT,
  summary TEXT
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  title TEXT,
  description TEXT,
  "productLines" JSONB,
  "offerDetails" TEXT,
  "validFrom" TIMESTAMP WITH TIME ZONE,
  "validTo" TIMESTAMP WITH TIME ZONE,
  "targetClientIds" JSONB,
  "perClientState" JSONB
);

CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  "cadenceDays" JSONB,
  templates JSONB
);

CREATE TABLE tier1_employees (
  id UUID PRIMARY KEY,
  "clientId" UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  department TEXT,
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  "processNotes" TEXT,
  "avgReplyTime" TEXT,
  "preferredChannel" TEXT
);

CREATE TABLE tier1_opportunities (
  id UUID PRIMARY KEY,
  "clientId" UUID REFERENCES clients(id) ON DELETE CASCADE,
  stage TEXT,
  value DOUBLE PRECISION,
  "productLine" TEXT,
  "ownerEmployeeId" UUID,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tier1_stage_transitions (
  id UUID PRIMARY KEY,
  "opportunityId" UUID REFERENCES tier1_opportunities(id) ON DELETE CASCADE,
  stage TEXT,
  date TIMESTAMP WITH TIME ZONE,
  "employeeId" UUID
);

CREATE TABLE tier1_projects (
  id UUID PRIMARY KEY,
  "clientId" UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT,
  location TEXT,
  "clientRole" TEXT,
  status TEXT,
  relevance TEXT,
  "sourceLink" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
