import { Router } from 'express';
import { canWrite, type AuthedRequest } from '../auth';
import { loadOrgContext } from '../org';
import { refreshPlaybooks, sanitizePlaybooks, loadPlaybooks } from '../playbooks';
import { assertWithinQuota } from '../usage';

export const profile = Router();

/** Rewrite the playbooks from what the user has searched, saved and asked. */
profile.post('/profile/playbooks/refresh', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role cannot change the profile' });
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    res.json(await refreshPlaybooks(r, { force: true }));
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Could not update the playbooks' });
  }
});

/** Save edits made by hand in Settings. */
profile.post('/profile/playbooks/save', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role cannot change the profile' });
  try {
    const org = await loadOrgContext(r.sb, r.orgId);
    const prev = loadPlaybooks(org);
    const next = sanitizePlaybooks(req.body?.playbooks ?? {}, prev, 'manual');
    const { error } = await r.sb.from('business_profiles').update({ config: { ...org.config, playbooks: next, playbooks_prev: prev } }).eq('org_id', r.orgId);
    if (error) throw new Error(error.message);
    res.json({ playbooks: next });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Could not save the playbooks' });
  }
});

/** Go back to the version before the last change. */
profile.post('/profile/playbooks/restore', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role cannot change the profile' });
  try {
    const org = await loadOrgContext(r.sb, r.orgId);
    const prev = (org.config as any).playbooks_prev;
    if (!prev) return res.status(404).json({ error: 'There is no earlier version.' });
    const { error } = await r.sb.from('business_profiles').update({ config: { ...org.config, playbooks: prev, playbooks_prev: (org.config as any).playbooks ?? null } }).eq('org_id', r.orgId);
    if (error) throw new Error(error.message);
    res.json({ playbooks: prev });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Could not restore' });
  }
});
