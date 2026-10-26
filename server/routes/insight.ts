import { Router } from 'express';
import { canWrite, type AuthedRequest } from '../auth';
import { assertWithinQuota } from '../usage';
import { decideLink, extractProjectCandidates, saveProjectCandidates } from '../projects';
import { predictForClient, savePredictions } from '../predict';

export const insight = Router();

/** The user pastes text on the Projects page: projects are saved, links to clients become proposals to review. */
insight.post('/projects/extract', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });
  const text = String(req.body?.text || '').trim();
  if (text.length < 40) return res.status(400).json({ error: 'Paste a bit more text' });
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    const { candidates, dropped } = await extractProjectCandidates(r, text);
    const saved = candidates.length ? await saveProjectCandidates(r, candidates, { text, kind: 'user' }) : { projects: [], proposals: 0, unlinked: [] };
    res.json({ ...saved, dropped });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

insight.post('/projects/links/:id/decide', async (req, res) => {
  const r = req as unknown as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });
  if (!['approve', 'reject'].includes(req.body?.decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  try { await decideLink(r, req.params.id, req.body.decision); res.json({ ok: true }); }
  catch (e: any) { res.status(409).json({ error: e.message }); }
});

/** Predict the next need for one client, or for the clients with the most data (capped). */
insight.post('/predictions/run', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    let ids: string[] = req.body?.clientId ? [req.body.clientId] : [];
    if (!ids.length) {
      const [{ data: p }, { data: e }] = await Promise.all([
        r.sb.from('project_participants').select('client_id').eq('org_id', r.orgId).limit(200),
        r.sb.from('enquiries').select('client_id').eq('org_id', r.orgId).limit(500),
      ]);
      ids = [...new Set([...(p ?? []), ...(e ?? [])].map((x: any) => x.client_id))].slice(0, 8);
    }
    let saved = 0;
    for (const id of ids) saved += await savePredictions(r, id, await predictForClient(r, id));
    res.json({ clients: ids.length, saved });
  } catch (e: any) { console.error('[predict]', e.message); res.status(e.status || 500).json({ error: e.message }); }
});
