import type { SupabaseClient } from '@supabase/supabase-js';

export interface TagDef { name: string; description: string | null; keywords: string[]; negative_keywords: string[]; color: string }

export interface ProfileConfig {
  categories?: string[];
  /** Natural-language tier rules written by the profile pack, e.g. [{tier:1,label:'Key account',rule:'...'}] */
  tier_rules?: Array<{ tier: 1 | 2 | 3 | 4; label: string; rule: string }>;
  presets?: Array<{ name: string; lat: number; lng: number; radius_km?: number }>;
  cadence_days?: Record<string, number>;
  product_lines?: string[];
  [k: string]: unknown;
}

export interface OrgContext {
  id: string;
  name: string;
  kind: 'business' | 'personal';
  country: string | null;
  summary: string | null;
  lookingFor: string | null;
  config: ProfileConfig;
  tags: TagDef[];
}

/** Loads everything the prompts need about one org. Runs as the user, so RLS applies. */
export async function loadOrgContext(sb: SupabaseClient, orgId: string): Promise<OrgContext> {
  const [org, profile, tags] = await Promise.all([
    sb.from('organizations').select('id,name,kind,country').eq('id', orgId).single(),
    sb.from('business_profiles').select('summary,looking_for,config').eq('org_id', orgId).maybeSingle(),
    sb.from('tag_definitions').select('name,description,keywords,negative_keywords,color,status').eq('org_id', orgId).neq('status', 'rejected'),
  ]);
  if (org.error) throw new Error(org.error.message);
  return {
    id: org.data.id,
    name: org.data.name,
    kind: org.data.kind,
    country: org.data.country,
    summary: profile.data?.summary ?? null,
    lookingFor: profile.data?.looking_for ?? null,
    config: (profile.data?.config as ProfileConfig) ?? {},
    tags: (tags.data as TagDef[]) ?? [],
  };
}
