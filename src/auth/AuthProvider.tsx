import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setActiveOrgForApi } from '../lib/api';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'sales' | 'viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  is_business: boolean | null;
  onboarding_step: number;
  default_org_id: string | null;
}
export interface Membership { org_id: string; role: OrgRole; org: { id: string; name: string; kind: 'business' | 'personal'; country: string | null } }

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  activeOrg: Membership | null;
  role: OrgRole | null;
  loading: boolean;
  /** owners and admins manage settings and members */
  isAdmin: boolean;
  /** viewers get no write buttons */
  canWrite: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setMemberships([]); setActiveOrgForApi(null); return; }
    const [p, m] = await Promise.all([
      supabase.from('profiles').select('id,full_name,is_business,onboarding_step,default_org_id').eq('id', s.user.id).maybeSingle(),
      supabase.from('memberships').select('org_id,role,org:organizations(id,name,kind,country)').eq('user_id', s.user.id),
    ]);
    const prof = (p.data as Profile) ?? null;
    const mem = ((m.data as any[]) ?? []).map((x) => ({ ...x, org: Array.isArray(x.org) ? x.org[0] : x.org })) as Membership[];
    setProfile(prof);
    setMemberships(mem);
    setActiveOrgForApi(prof?.default_org_id ?? mem[0]?.org_id ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      // Defer: calling supabase inside this callback can deadlock the auth lock.
      setTimeout(() => { load(s).finally(() => setLoading(false)); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const value = useMemo<AuthState>(() => {
    const activeOrg = memberships.find((m) => m.org_id === profile?.default_org_id) ?? memberships[0] ?? null;
    const role = activeOrg?.role ?? null;
    return {
      session, profile, memberships, activeOrg, role, loading,
      isAdmin: role === 'owner' || role === 'admin',
      canWrite: role === 'owner' || role === 'admin' || role === 'manager' || role === 'sales',
      refresh: async () => { await load(session); },
      signOut: async () => { await supabase.auth.signOut(); },
    };
  }, [session, profile, memberships, loading, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
