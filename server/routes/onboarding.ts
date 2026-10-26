import { Router } from 'express';
import { createHash } from 'node:crypto';
import type { AuthedRequest } from '../auth';
import { canManageRole } from '../auth';
import { chatJson } from '../llm';
import { tokenSink, assertWithinQuota, addUsage } from '../usage';
import { loadOrgContext } from '../org';
import { profilePackPrompt } from '../prompts/profilePack';
import { verifyQuote } from '../evidence';
import { fence, screenWithPatterns, cleanText } from '../security/untrusted';
import { tavilyExtract, tavilySearch } from '../tavily';
import { config } from '../config';

export const onboarding = Router();

interface Src { kind: 'user' | 'tavily' | 'web'; url?: string; title: string; content: string }

async function geocodeName(name: string, country: string | null) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', country ? `${name}, ${country}` : name);
  url.searchParams.set('key', config.googleKey);
  const g = await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).json();
  const top = g.results?.[0];
  if (!top) return null;
  const vp = top.geometry.viewport;
  const span = vp ? Math.max(Math.abs(vp.northeast.lat - vp.southwest.lat), Math.abs(vp.northeast.lng - vp.southwest.lng)) : 0.1;
  return { name, lat: top.geometry.location.lat, lng: top.geometry.location.lng, radius_km: Math.min(30, Math.max(2, Math.round(span * 55))) };
}

/**
 * Task 12 and 13: research the user, then let Ultra draft the profile pack.
 * Nothing is saved to the profile here; the user reviews and approves first.
 * Sources are saved so every cited quote can be checked and shown later.
 */
onboarding.post('/onboarding/profile-pack', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canManageRole(r.role)) return res.status(403).json({ error: 'Only owners, admins and managers can set the profile' });
  const text = cleanText(String(req.body?.text || '')).slice(0, 6000);
  const website = String(req.body?.website || '').trim();
  if (!text && !website) return res.status(400).json({ error: 'Describe your business or need, or add a website' });

  try {
    await assertWithinQuota(r.sb, r.orgId, 'tokens');
    const org = await loadOrgContext(r.sb, r.orgId);
    const sources: Src[] = [];
    if (text) sources.push({ kind: 'user', title: 'Your description', content: text });

    const notes: string[] = [];
    if (website) {
      try {
        for (const p of await tavilyExtract(r.sb, r.orgId, [website])) {
          if (p.content) sources.push({ kind: 'tavily', url: p.url, title: 'Website', content: p.content.slice(0, 8000) });
        }
      } catch (e: any) { notes.push(`Could not read ${website}: ${e.message}`); }
    }
    const who = org.kind === 'business' ? org.name : text.slice(0, 80);
    const jobs: Array<Promise<void>> = [];
    const addSearch = (q: string, domains?: string[]) => jobs.push(
      tavilySearch(r.sb, r.orgId, q, { maxResults: 3, includeDomains: domains }).then((s) => {
        for (const x of s.results) sources.push({ kind: 'tavily', url: x.url, title: x.title, content: x.content });
      }).catch((e) => { notes.push(`Search failed: ${e.message}`); }));
    if (org.kind === 'business') {
      addSearch(`${who} ${website || ''} company products services customers`.trim());
      addSearch(`${who} company page`, ['linkedin.com', 'instagram.com']); // public pages only, through Tavily
    }
    await Promise.all(jobs);

    // Save sources, then ask Ultra with fenced, numbered text.
    const rows = sources.map((s) => ({
      org_id: r.orgId, kind: s.kind === 'user' ? 'user' : 'tavily', url: s.url ?? null, title: s.title.slice(0, 200),
      content: s.content, content_hash: createHash('sha256').update(s.content).digest('hex'),
    }));
    const saved = rows.length ? await r.sb.from('sources').insert(rows).select('id') : { data: [] as any[], error: null };
    if (saved.error) throw new Error(saved.error.message);

    const numbered = sources.map((s, i) => `Source ${i}:\n` + fence(s.content.slice(0, 5000), s.url || s.kind, screenWithPatterns(s.content).suspicious)).join('\n\n');
    const pack = await chatJson<any>({
      role: 'ultra', thinking: true, maxTokens: 6000, temperature: 0.3,
      onUsage: tokenSink(r.sb, r.orgId),
      messages: [
        { role: 'system', content: profilePackPrompt(org, sources.length) },
        { role: 'user', content: numbered || '(no sources)' },
      ],
    });

    // Evidence Gate on the tags' citations; verified quotes become evidence rows.
    const tags = [] as any[];
    for (const t of Array.isArray(pack.tags) ? pack.tags.slice(0, 16) : []) {
      if (!t?.name) continue;
      const idx = Number(t.cite?.source);
      const src = sources[idx];
      const verified = !!(src && t.cite?.quote && verifyQuote(src.content, t.cite.quote));
      let evidenceId: string | null = null;
      if (verified) {
        const ev = await r.sb.from('evidence').insert({ org_id: r.orgId, source_id: saved.data![idx].id, quote: String(t.cite.quote).slice(0, 500), verified: true }).select('id').single();
        evidenceId = ev.data?.id ?? null;
      }
      tags.push({
        name: String(t.name).toLowerCase().slice(0, 40),
        description: String(t.description || '').slice(0, 300),
        keywords: (t.keywords || []).slice(0, 12).map(String),
        negative_keywords: (t.negative_keywords || []).slice(0, 12).map(String),
        color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#6b7280',
        verified, evidenceId, quote: verified ? t.cite.quote : null, sourceUrl: verified ? src.url ?? null : null,
      });
    }

    const presetNames: string[] = (pack.preset_areas || []).slice(0, 6).map(String);
    const presets = (await Promise.all(presetNames.map((n) => geocodeName(n, org.country).catch(() => null)))).filter(Boolean);
    await addUsage(r.sb, r.orgId, { google: presetNames.length });

    res.json({
      summary: String(pack.summary || ''),
      offerings: (pack.offerings || []).slice(0, 12).map(String),
      target_customers: (pack.target_customers || []).slice(0, 12).map(String),
      tags,
      categories: (pack.categories || []).slice(0, 10).map(String),
      tier_rules: (pack.tier_rules || []).slice(0, 4),
      product_lines: (pack.product_lines || []).slice(0, 20).map(String),
      presets,
      cadence_days: pack.cadence_days || { '1': 7, '2': 14, '3': 30, '4': 60 },
      sourcesUsed: sources.length,
      notes,
    });
  } catch (e: any) {
    console.error('[profile-pack]', e);
    res.status(e.status || 500).json({ error: e.message || 'Could not build the profile' });
  }
});

/** The user approved (possibly edited) the pack: save it as the org's profile, tags and products. */
onboarding.post('/onboarding/profile-pack/approve', async (req, res) => {
  const r = req as AuthedRequest;
  if (!canManageRole(r.role)) return res.status(403).json({ error: 'Not allowed' });
  const p = req.body?.pack;
  if (!p || typeof p !== 'object') return res.status(400).json({ error: 'pack required' });
  try {
    const profile = await r.sb.from('business_profiles').update({
      summary: String(p.summary || '').slice(0, 2000),
      looking_for: req.body?.lookingFor ? String(req.body.lookingFor).slice(0, 2000) : null,
      offerings: p.offerings || [],
      target_customers: p.target_customers || [],
      config: {
        categories: p.categories || [], tier_rules: p.tier_rules || [], presets: p.presets || [],
        cadence_days: p.cadence_days || {}, product_lines: p.product_lines || [],
      },
      status: 'approved', approved_by: r.user.id, approved_at: new Date().toISOString(),
    }).eq('org_id', r.orgId);
    if (profile.error) throw new Error(profile.error.message);

    const tags = (p.tags || []).filter((t: any) => t?.name).map((t: any) => ({
      org_id: r.orgId, name: String(t.name).toLowerCase().slice(0, 40), description: t.description || null,
      keywords: t.keywords || [], negative_keywords: t.negative_keywords || [], color: t.color || '#6b7280',
      origin: 'agent', status: 'approved',
    }));
    if (tags.length) {
      const t = await r.sb.from('tag_definitions').upsert(tags, { onConflict: 'org_id,name' });
      if (t.error) throw new Error(t.error.message);
    }
    const products = (p.product_lines || []).map((n: string) => ({ org_id: r.orgId, name: String(n).slice(0, 120) }));
    if (products.length) await r.sb.from('products').insert(products);

    await r.sb.from('profiles').update({ onboarding_step: 4 }).eq('id', r.user.id);
    await r.sb.from('audit_log').insert({ org_id: r.orgId, actor_id: r.user.id, action: 'profile_pack_approved', entity: 'business_profiles', details: { tags: tags.length } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
