import { supabase } from './supabase';

let activeOrgId: string | null = null;
export const setActiveOrgForApi = (id: string | null) => { activeOrgId = id; };

/** fetch() for our own /api routes: adds the user's token and the active org. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  if (activeOrgId) headers.set('x-org-id', activeOrgId);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(path, { ...init, headers });
}
