import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'sales' | 'viewer';

export interface AuthedRequest extends Request {
  user: User;
  /** Supabase client that carries the caller's JWT, so RLS applies to every query. */
  sb: SupabaseClient;
  orgId: string;
  role: OrgRole;
}

/** A client acting as the signed-in user. Never uses the service-role key. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Express middleware: validates the Bearer token, builds the per-request client and
 * resolves the active org from the `x-org-id` header (falling back to the profile default).
 * Membership is read through RLS, so a forged org id simply finds no row.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in required' });

    const sb = userClient(token);
    const { data: u, error } = await sb.auth.getUser(token);
    if (error || !u.user) return res.status(401).json({ error: 'Session expired, sign in again' });

    let orgId = (req.headers['x-org-id'] as string | undefined) || '';
    if (!orgId) {
      const { data: p } = await sb.from('profiles').select('default_org_id').eq('id', u.user.id).maybeSingle();
      orgId = p?.default_org_id || '';
    }
    if (!orgId) return res.status(409).json({ error: 'Finish onboarding first' });

    const { data: m } = await sb
      .from('memberships').select('role').eq('org_id', orgId).eq('user_id', u.user.id).maybeSingle();
    if (!m) return res.status(403).json({ error: 'Not a member of this organisation' });

    Object.assign(req, { user: u.user, sb, orgId, role: m.role as OrgRole });
    next();
  } catch (e: any) {
    console.error('[auth]', e);
    res.status(500).json({ error: 'Auth check failed' });
  }
}

const WRITERS: OrgRole[] = ['owner', 'admin', 'manager', 'sales'];
export const canWrite = (role: OrgRole) => WRITERS.includes(role);
export const canManageRole = (role: OrgRole) => ['owner', 'admin', 'manager'].includes(role);
