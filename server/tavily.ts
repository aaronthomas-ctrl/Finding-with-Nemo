import type { SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { assertWithinQuota, addUsage } from './usage';
import { cleanText } from './security/untrusted';

const BASE = 'https://api.tavily.com';

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.tavilyKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Tavily ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

export interface WebResult { url: string; title: string; content: string; score?: number }

/** Public web search. The only route to LinkedIn and Instagram pages: public results only. */
export async function tavilySearch(
  sb: SupabaseClient, orgId: string, query: string,
  opts: { maxResults?: number; includeDomains?: string[]; answer?: boolean; depth?: 'basic' | 'advanced' } = {},
) {
  await assertWithinQuota(sb, orgId, 'tavily');
  const data = await call<{ answer?: string; results: WebResult[] }>('/search', {
    query,
    max_results: opts.maxResults ?? 5,
    search_depth: opts.depth ?? 'basic',
    include_answer: opts.answer ?? false,
    include_domains: opts.includeDomains,
  });
  await addUsage(sb, orgId, { tavily: opts.depth === 'advanced' ? 2 : 1 });
  return {
    answer: data.answer ? cleanText(data.answer) : undefined,
    results: data.results.map((r) => ({ ...r, title: cleanText(r.title), content: cleanText(r.content) })),
  };
}

export async function tavilyExtract(sb: SupabaseClient, orgId: string, urls: string[]) {
  await assertWithinQuota(sb, orgId, 'tavily');
  const data = await call<{ results: Array<{ url: string; raw_content: string }>; failed_results?: unknown[] }>('/extract', { urls });
  await addUsage(sb, orgId, { tavily: Math.max(1, Math.ceil(urls.length / 5)) });
  return data.results.map((r) => ({ url: r.url, content: cleanText(r.raw_content || '') }));
}

export async function tavilyCrawl(sb: SupabaseClient, orgId: string, url: string, instructions?: string, limit = 10) {
  await assertWithinQuota(sb, orgId, 'tavily');
  const data = await call<{ results: Array<{ url: string; raw_content: string }> }>('/crawl', { url, instructions, limit });
  await addUsage(sb, orgId, { tavily: Math.max(2, Math.ceil(limit / 5)) });
  return data.results.map((r) => ({ url: r.url, content: cleanText(r.raw_content || '') }));
}
