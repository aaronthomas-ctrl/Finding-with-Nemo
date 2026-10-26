import { Router } from 'express';
import { canWrite, type AuthedRequest } from '../auth';
import { loadOrgContext } from '../org';
import { runAgent } from '../agent/loop';
import { byName } from '../agent/registry';
import type { AgentEvent } from '../agent/types';

export const agent = Router();

/** Streams the agent's reply as server-sent events. */
agent.post('/agent/chat', async (req, res) => {
  const r = req as AuthedRequest;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (e: AgentEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  const ctl = new AbortController();
  res.on('close', () => ctl.abort());
  try {
    await runAgent(r, req.body, send, ctl.signal);
  } catch (e: any) {
    console.error('[agent]', e);
    send({ type: 'error', message: e?.status === 429 ? e.message : String(e?.message || 'Agent failed') });
  }
  res.end();
});

/** The user approves (optionally dropping some items) or rejects a proposal. Only now does anything change. */
agent.post('/agent/approvals/:id/decide', async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { decision, exclude = [], confirm = false } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });

  const { data: ap, error } = await r.sb.from('approvals').select('*').eq('id', req.params.id).eq('org_id', r.orgId).maybeSingle();
  if (error || !ap) return res.status(404).json({ error: 'Proposal not found' });
  if (ap.status !== 'pending') return res.status(409).json({ error: `Already ${ap.status}` });
  const tool = byName.get(ap.tool);
  if (!tool?.apply) return res.status(400).json({ error: 'This proposal cannot be applied' });

  const finish = async (status: 'approved' | 'rejected', message: string) => {
    // Maps data is not kept: once decided, only the summary and outcome stay on the record.
    await r.sb.from('approvals').update({
      status, decided_by: r.user.id, decided_at: new Date().toISOString(),
      proposal: { summary: ap.proposal.summary, bulk: ap.proposal.bulk, redacted: true, outcome: message },
    }).eq('id', ap.id).eq('org_id', r.orgId);
    await r.sb.from('audit_log').insert({ org_id: r.orgId, actor_id: r.user.id, action: `proposal_${status}`, entity: ap.tool, entity_id: ap.id, details: { summary: ap.proposal.summary } });
  };

  if (decision === 'reject') { await finish('rejected', 'Rejected'); return res.json({ ok: true, message: 'Rejected.' }); }
  if (ap.proposal.bulk && !confirm) return res.status(409).json({ error: 'Bulk changes need a second confirmation', needsConfirm: true });

  try {
    const payload = { ...ap.proposal.payload };
    const drop = new Set<number>(exclude);
    for (const key of ['companies', 'tags', 'proposals', 'stops']) {
      if (Array.isArray(payload[key]) && drop.size) payload[key] = payload[key].filter((_: unknown, i: number) => !drop.has(i));
    }
    const org = await loadOrgContext(r.sb, r.orgId);
    const out = await tool.apply(payload, { req: r, org });
    await finish('approved', out.message);
    res.json({ ok: true, message: out.message, ui: out.ui ?? [] });
  } catch (e: any) {
    console.error('[approve]', e);
    res.status(500).json({ error: e?.message || 'Could not apply the change' });
  }
});
