import { Router } from 'express';
import { UMAP } from 'umap-js';
import { canWrite, type AuthedRequest } from '../auth';
import { assertWithinQuota } from '../usage';
import { ingestText, recall } from '../memory';

export const memory = Router();

/** Paste a note, article or call summary: facts are extracted, quote-checked and remembered. */
memory.post('/memory/ingest', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });
  const text = String(req.body?.text || '').trim();
  if (text.length < 20) return res.status(400).json({ error: 'Add a bit more text' });
  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    const out = await ingestText({ sb: r.sb, orgId: r.orgId, userId: r.user.id }, {
      text, kind: 'user', title: String(req.body?.title || 'Pasted note'), clientId: req.body?.clientId || null,
    });
    res.json(out);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

memory.post('/memory/recall', async (req, res) => {
  const r = req as AuthedRequest;
  try {
    const q = String(req.body?.query || '').slice(0, 500);
    if (!q) return res.status(400).json({ error: 'query required' });
    res.json({ memories: await recall({ sb: r.sb, orgId: r.orgId }, q, Math.min(20, Number(req.body?.count) || 8)) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Seeded PRNG so the same memories always land in the same place.
function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Reduces embeddings to x, y, z with UMAP and stores them, then links memories that share a client or project.
 * Runs on demand now; the same function is the body of the Nebius layout Job.
 */
export async function layoutMemories(sb: AuthedRequest['sb'], orgId: string) {
  const { data, error } = await sb.from('memories').select('id,embedding,client_id,project_id,created_at').eq('org_id', orgId).not('embedding', 'is', null).limit(4000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((m: any) => ({ ...m, vec: (typeof m.embedding === 'string' ? JSON.parse(m.embedding) : m.embedding) as number[] }));
  if (!rows.length) return { positioned: 0, links: 0 };

  let coords: number[][];
  if (rows.length < 6) {
    coords = rows.map((_, i) => [Math.cos((i / rows.length) * 6.28) * 120, Math.sin((i / rows.length) * 6.28) * 120, (i - rows.length / 2) * 20]);
  } else {
    const umap = new UMAP({ nComponents: 3, nNeighbors: Math.min(15, rows.length - 1), minDist: 0.3, random: mulberry32(42) });
    const raw = umap.fit(rows.map((r) => r.vec));
    const maxAbs = Math.max(1e-6, ...raw.flat().map(Math.abs));
    coords = raw.map((p) => p.map((v) => (v / maxAbs) * 300));
  }

  const items = rows.map((r, i) => ({ id: r.id, x: coords[i][0], y: coords[i][1], z: coords[i][2] }));
  for (let i = 0; i < items.length; i += 500) {
    const { error: e } = await sb.rpc('set_memory_positions', { p_org: orgId, p_items: items.slice(i, i + 500) });
    if (e) throw new Error(e.message);
  }

  // Edges: chain memories of the same client or project in time order.
  const links: any[] = [];
  for (const key of ['client_id', 'project_id'] as const) {
    const groups = new Map<string, typeof rows>();
    for (const r of rows) if (r[key]) groups.set(r[key], [...(groups.get(r[key]) ?? []), r]);
    for (const g of groups.values()) {
      g.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      for (let i = 1; i < g.length; i++) links.push({ org_id: orgId, from_id: g[i - 1].id, to_id: g[i].id, relation: key === 'client_id' ? 'same_client' : 'same_project', weight: 1 });
    }
  }
  if (links.length) {
    const { error: e } = await sb.from('memory_links').upsert(links, { onConflict: 'from_id,to_id,relation', ignoreDuplicates: true });
    if (e) throw new Error(e.message);
  }
  return { positioned: items.length, links: links.length };
}

memory.post('/memory/layout', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canWrite(r.role)) return res.status(403).json({ error: 'Your role is read-only' });
  try { res.json(await layoutMemories(r.sb, r.orgId)); }
  catch (e: any) { console.error('[layout]', e); res.status(500).json({ error: e.message }); }
});
