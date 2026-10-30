import { tavilySearch } from '../../tavily';
import { loadPlaybooks, researchQueries } from '../../playbooks';
import { ingestText, recall } from '../../memory';
import { canWrite } from '../../auth';
import { cleanText, screenWithPatterns } from '../../security/untrusted';
import type { ToolDef } from '../types';

export const researchCompany: ToolDef = {
  name: 'research_company',
  write: false,
  description: 'Research a company on the public web with Tavily (its site, directories, public LinkedIn and Instagram pages). Facts found are quote-checked against the page and remembered; the result lists which are verified.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      question: { type: 'string', description: 'What to find out, e.g. "upcoming projects"' },
      client_id: { type: 'string', description: 'Attach the findings to this saved client' },
    },
    required: ['name'],
  },
  async run(args, ctx) {
    const query = `${String(args.name).slice(0, 120)} ${String(args.question || 'company overview').slice(0, 160)}`;
    // The organisation's playbook decides what to look for about a company (projects, news, LinkedIn, careers ...).
    const plan = researchQueries(loadPlaybooks(ctx.org), String(args.name).slice(0, 120), null);
    const runs = await Promise.all([
      tavilySearch(ctx.req.sb, ctx.req.orgId, query, { maxResults: 4, answer: false }),
      ...plan.slice(0, 3).map((p) => tavilySearch(ctx.req.sb, ctx.req.orgId, p.q, { maxResults: 3, answer: false, includeDomains: p.domains }).catch(() => ({ results: [] as any[] }))),
    ]);
    const seen = new Set<string>();
    const web = { results: runs.flatMap((x) => x.results).filter((r: any) => !seen.has(r.url) && seen.add(r.url)).slice(0, 8) };
    const pages = web.results.filter((r: any) => r.content.length > 60);
    if (pages.some((p) => screenWithPatterns(p.content).suspicious)) ctx.state.tainted = true;

    const learned: Array<{ claim: string; verified: boolean; source: string; memory_id?: string }> = [];
    if (canWrite(ctx.req.role)) {
      // Evidence Gate: Ultra proposes facts with quotes, code checks each quote against the page.
      const done = await Promise.all(pages.slice(0, 4).map((p) =>
        ingestText({ sb: ctx.req.sb, orgId: ctx.req.orgId, userId: ctx.req.user.id }, { text: `${p.title}\n${p.content}`, kind: 'web', url: p.url, title: p.title, clientId: args.client_id || null })
          .then((r) => r.claims.map((c) => ({ claim: c.claim, verified: c.verified, source: p.url, memory_id: c.memoryId?.slice(0, 8) })))
          .catch(() => [] as any[])));
      learned.push(...done.flat());
    }
    return {
      untrusted: true,
      data: {
        query,
        pages: pages.map((p) => ({ title: p.title, url: p.url, excerpt: cleanText(p.content).slice(0, 300) })),
        facts_remembered: learned,
        note: 'Cite remembered facts as [m:memory_id]. Say which are unverified.',
      },
    };
  },
};

export const recallMemories: ToolDef = {
  name: 'recall_memories',
  write: false,
  description: 'Search what the organisation already knows (facts, interactions, voice notes, profile) by meaning.',
  parameters: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'number' } }, required: ['query'] },
  async run(args, ctx) {
    const mems = await recall({ sb: ctx.req.sb, orgId: ctx.req.orgId }, String(args.query), Math.min(15, Number(args.count) || 8));
    return {
      untrusted: true,
      data: { count: mems.length, memories: mems.map((m) => ({ id: m.id.slice(0, 8), kind: m.kind, content: m.content, similarity: Math.round(m.similarity * 100) / 100 })) },
    };
  },
};
