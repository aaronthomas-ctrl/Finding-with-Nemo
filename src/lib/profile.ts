import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getActiveOrgId } from './api';
import { useAuth } from '../auth/AuthProvider';
import type { PresetRegion } from './geo';

export interface ProfileConfig {
  categories?: string[];
  presets?: Array<{ name: string; lat: number; lng: number; radius_km?: number }>;
  cadence_days?: Record<string, number>;
  product_lines?: string[];
  [k: string]: unknown;
}

/** The org's generated profile config: categories, search-area presets, cadence, product lines. */
export function useProfileConfig(): ProfileConfig {
  const { activeOrg } = useAuth();
  const [cfg, setCfg] = useState<ProfileConfig>({});
  useEffect(() => {
    const id = activeOrg?.org_id ?? getActiveOrgId();
    if (!id) return;
    supabase.from('business_profiles').select('config').eq('org_id', id).maybeSingle()
      .then(({ data }) => setCfg((data?.config as ProfileConfig) ?? {}));
  }, [activeOrg?.org_id]);
  return cfg;
}

export function usePresetRegions(): PresetRegion[] {
  const cfg = useProfileConfig();
  return (cfg.presets ?? []).map((p) => ({ name: p.name, region: '', lat: p.lat, lng: p.lng, description: p.radius_km ? `About ${p.radius_km} km across` : '' }));
}

/** Categories come from the profile; the list is empty until the profile exists. */
export function useCategories(): string[] {
  const cfg = useProfileConfig();
  return Array.from(new Set([...(cfg.categories ?? []), 'Other']));
}

/** Product lines or services the org sells, from the profile. */
export function useProductLines(): string[] {
  const cfg = useProfileConfig();
  return cfg.product_lines ?? [];
}

/** The org's own approved tag names. These are what "Find Leads Here" searches for; nothing is hardcoded. */
export function useOrgTagNames(): string[] {
  const { activeOrg } = useAuth();
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    const id = activeOrg?.org_id ?? getActiveOrgId();
    if (!id) return;
    supabase.from('tag_definitions').select('name').eq('org_id', id).neq('status', 'rejected')
      .then(({ data }) => setNames((data ?? []).map((t: any) => String(t.name))));
  }, [activeOrg?.org_id]);
  return names;
}

/** Search keyword suggestions: the org's own tag names and keywords. */
export function useSearchSuggestions(): string[] {
  const { activeOrg } = useAuth();
  const [terms, setTerms] = useState<string[]>([]);
  useEffect(() => {
    const id = activeOrg?.org_id ?? getActiveOrgId();
    if (!id) return;
    supabase.from('tag_definitions').select('name,keywords').eq('org_id', id).neq('status', 'rejected')
      .then(({ data }) => setTerms(Array.from(new Set((data ?? []).flatMap((t: any) => [t.name, ...(t.keywords ?? [])])))));
  }, [activeOrg?.org_id]);
  return terms;
}
