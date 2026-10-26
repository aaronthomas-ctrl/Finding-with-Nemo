import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { chatJson } from './llm';
import { tokenSink } from './usage';
import { loadOrgContext, type OrgContext } from './org';
import { readWebsite } from './routes/enrich';
import { tavilyExtract, tavilySearch } from './tavily';
import { verifyQuote } from './evidence';
import { ingestText } from './memory';
import { changeCheckPrompt, changeSummaryPrompt } from './prompts/watcher';
import { assertPublicUrl } from './security/ssrf';
import { extractProjectCandidates, saveProjectCandidates } from './projects';
import { cleanText, fence, screenWithPatterns } from './security/untrusted';

export interface Watcher {
  id: string; org_id: string; client_id: string | null; created_by: string | null;
  kind: 'website' | 'social' | 'news' | 'projects'; target: string; every: 'daily' | 'weekly';
  last_hash: string | null; last_run_at: string | null; active: boolean;
}

export interface Outcome { watcherId: string; status: 'ok' | 'changed' | 'failed'; summary: string }

export interface WatchCtx { sb: SupabaseClient; orgId: string; userId: string }

const DUE_MS = { daily: 20 * 3600e3, weekly: 6.5 * 864e5 };
export const isDue = (w: Watcher) => !w.last_run_at || Date.now() - new Date(w.last_run_at).getTime() >= DUE_MS[w.every];

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const squash = (s: string) => cleanText(s).replace(/\s+/g, ' ').trim();
const sentences = (s: string) => s.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length > 25);

/** Only public company or profile pages on these hosts are fetched, and only through Tavily. */
function socialUrl(target: string) {
  const u = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`);
  const host = u.hostname.replace(/^www\./, '');
  if (!['linkedin.com', 'instagram.com'].includes(host)) throw new Error('Social watchers support public LinkedIn company pages and Instagram pages only');
  if (host === 'linkedin.com' && !u.pathname.startsWith('/company/')) throw new Error('Use a public LinkedIn company page (linkedin.com/company/...)');
  return u.toString();
}

/** One snapshot of what the watcher looks at, as lines of text so a diff is easy. */
async function snapshot(ctx: WatchCtx, w: Watcher): Promise<{ lines: string[]; url: string | null }> {
  if (w.kind === 'website') {
    await assertPublicUrl(w.target);
    const site = await readWebsite(w.target);
    return { lines: sentences(site.text), url: site.url };
  }
  if (w.kind === 'social') {
    const url = socialUrl(w.target);
    const pages = await tavilyExtract(ctx.sb, ctx.orgId, [url]);
    return { lines: sentences(pages.map((p) => p.content).join('\n')), url };
  }
  // news and projects: a search, one line per result, so a new result shows up as a new line
  const q = w.kind === 'news' ? `${w.target} latest news` : w.target;
  const web = await tavilySearch(ctx.sb, ctx.orgId, q, { maxResults: 8 });
  return { lines: web.results.map((r) => `${squash(r.title)} (${r.url}): ${squash(r.content).slice(0, 240)}`), url: null };
}

/**
 * One watcher run. Compare content hashes; only when it differs does Nano judge the change and
 * Ultra summarise it. Facts pass the Evidence Gate into memory, and the user gets an in-app notification.
 */
export async function runWatcher(
  ctx: WatchCtx, w: Watcher, org: OrgContext,
  notify: (n: { userId: string | null; title: string; body: string; link: string }) => Promise<void>,
): Promise<Outcome> {
  const log = async (status: Outcome['status'], summary: string, sourceId: string | null = null) => {
    await ctx.sb.from('watcher_runs').insert({ org_id: ctx.orgId, watcher_id: w.id, status, summary: summary.slice(0, 800), source_id: sourceId });
    return { watcherId: w.id, status, summary } as Outcome;
  };
  try {
    const snap = await snapshot(ctx, w);
    const text = snap.lines.join('\n');
    if (text.length < 40) return await log('failed', 'The page had no readable text.');
    const hash = sha(snap.lines.map(squash).join('\n'));

    const { data: prevRun } = await ctx.sb.from('watcher_runs').select('source_id').eq('watcher_id', w.id).eq('org_id', ctx.orgId)
      .not('source_id', 'is', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
    const prevSrc = prevRun?.source_id
      ? (await ctx.sb.from('sources').select('content').eq('id', prevRun.source_id).maybeSingle()).data?.content as string | undefined
      : undefined;

    const src = await ctx.sb.from('sources').insert({ org_id: ctx.orgId, kind: w.kind === 'website' ? 'web' : 'tavily', url: snap.url ?? (w.kind === 'website' ? w.target : null), title: `Watcher: ${w.target}`.slice(0, 200), content: text, content_hash: hash }).select('id').single();
    const sourceId = src.error ? null : (src.data.id as string);
    await ctx.sb.from('watchers').update({ last_hash: hash, last_run_at: new Date().toISOString() }).eq('id', w.id).eq('org_id', ctx.orgId);

    if (!w.last_hash) return await log('ok', 'Baseline saved. Changes will be reported from the next run.', sourceId);
    if (w.last_hash === hash) return await log('ok', 'No change.', sourceId);

    // Changed: work out exactly what is new.
    const old = new Set((prevSrc ? prevSrc.split('\n') : []).map((l) => squash(l).toLowerCase()));
    const added = snap.lines.filter((l) => !old.has(squash(l).toLowerCase())).join('\n').slice(0, 5000);
    if (!added.trim()) return await log('ok', 'Content moved around but nothing new was added.', sourceId);

    const screen = screenWithPatterns(added);
    const wrapped = fence(added, w.target, screen.suspicious);

    // Nano: noise or news?
    const check = await chatJson<{ meaningful?: boolean; reason?: string }>({
      role: 'nano', thinking: false, maxTokens: 200, temperature: 0, onUsage: tokenSink(ctx.sb, ctx.orgId),
      messages: [{ role: 'system', content: changeCheckPrompt(org) }, { role: 'user', content: wrapped }],
    });
    if (!check.meaningful) return await log('ok', `Changed, but not significant: ${check.reason ?? 'routine page changes'}`, sourceId);

    // Ultra: what changed and why it matters.
    const sum = await chatJson<{ title?: string; summary?: string; quote?: string }>({
      role: 'ultra', thinking: false, maxTokens: 500, temperature: 0.2, onUsage: tokenSink(ctx.sb, ctx.orgId),
      messages: [{ role: 'system', content: changeSummaryPrompt(org, w.target) }, { role: 'user', content: wrapped }],
    });
    const verified = verifyQuote(added, sum.quote || '');
    const summary = `${String(sum.summary || check.reason || 'Change detected').slice(0, 600)}${verified ? '' : ' (quote not found on the page; unverified)'}`;

    // Keep the new facts, quote-checked, as memories tied to the client.
    await ingestText({ sb: ctx.sb, orgId: ctx.orgId, userId: ctx.userId }, {
      text: added, kind: 'web', url: snap.url ?? undefined, title: `Watcher: ${w.target}`, clientId: w.client_id,
    }).catch((e) => console.warn('[watcher] memory ingest failed:', e.message));

    // A projects watcher also grows the project graph; links to clients stay proposals until approved.
    if (w.kind === 'projects') {
      const authed: any = { sb: ctx.sb, orgId: ctx.orgId, user: { id: ctx.userId } };
      await extractProjectCandidates(authed, added).then((x) => x.candidates.length ? saveProjectCandidates(authed, x.candidates, { text: added, kind: 'web' }) : null).catch((e) => console.warn('[watcher] project extract failed:', e.message));
    }

    let clientName = '';
    if (w.client_id) clientName = (await ctx.sb.from('clients').select('name').eq('id', w.client_id).maybeSingle()).data?.name ?? '';
    await notify({
      userId: w.created_by,
      title: String(sum.title || `Change on ${clientName || w.target}`).slice(0, 120),
      body: `${clientName ? `${clientName}: ` : ''}${summary}`,
      link: w.client_id ? `/pipeline/${w.client_id}` : '/watchers',
    });
    return await log('changed', summary, sourceId);
  } catch (e: any) {
    return await log('failed', String(e?.message || e).slice(0, 300));
  }
}

/** Run a set of watchers with Nano-sized parallelism. */
export async function runWatchers(ctx: WatchCtx, list: Watcher[]): Promise<Outcome[]> {
  const org = await loadOrgContext(ctx.sb, ctx.orgId);
  const notify = async (n: { userId: string | null; title: string; body: string; link: string }) => {
    const { error } = await ctx.sb.rpc('notify', { p_org: ctx.orgId, p_user: n.userId ?? ctx.userId, p_kind: 'watcher', p_title: n.title, p_body: n.body, p_link: n.link });
    if (error) console.warn('[watcher] notify failed:', error.message);
  };
  const queue = [...list];
  const out: Outcome[] = [];
  await Promise.all(Array.from({ length: Math.min(5, list.length) }, async () => {
    for (let w = queue.shift(); w; w = queue.shift()) out.push(await runWatcher(ctx, w, org, notify));
  }));
  return out;
}
