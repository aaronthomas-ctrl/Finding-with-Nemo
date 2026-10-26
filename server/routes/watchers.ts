import { Router } from 'express';
import { canWrite, type AuthedRequest } from '../auth';
import { assertWithinQuota } from '../usage';
import { isDue, runWatchers, type Watcher } from '../watchers';

export const watchers = Router();

/** Run now: one watcher by id, or every active watcher that is due (add force to run them all). */
watchers.post('/watchers/run', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    let q = r.sb.from('watchers').select('*').eq('org_id', r.orgId).eq('active', true);
    if (req.body?.id) q = q.eq('id', req.body.id);
    const { data, error } = await q.limit(50);
    if (error) throw new Error(error.message);
    const list = ((data ?? []) as Watcher[]).filter((w) => req.body?.id || req.body?.force || isDue(w));
    const outcomes = list.length ? await runWatchers({ sb: r.sb, orgId: r.orgId, userId: r.user.id }, list) : [];

    // The nightly housekeeping that used to run in the browser: flag clients whose outreach got no reply.
    let retryFlagged: number | null = null;
    if (!req.body?.id) {
      const { data: n } = await r.sb.rpc('sweep_retry_flags', { p_org: r.orgId });
      retryFlagged = typeof n === 'number' ? n : null;
    }
    res.json({ ran: outcomes.length, outcomes, retryFlagsChanged: retryFlagged });
  } catch (e: any) {
    console.error('[watchers]', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});
