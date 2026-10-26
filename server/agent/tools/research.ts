import { createHash } from 'node:crypto';
import { tavilySearch } from '../../tavily';
import { cleanText, screenWithPatterns } from '../../security/untrusted';
import type { ToolDef } from '../types';

export const researchCompany: ToolDef = {
  name: 'research_company',
  write: false,
  description: 'Research a company on the public web with Tavily (its site, directories, public LinkedIn and Instagram pages). Each page is saved as a source so claims can be traced.',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string' }, question: { type: 'string', description: 'What to find out, e.g. "upcoming projects"' } },
    required: ['name'],
  },
  async run(args, ctx) {
    const query = `${String(args.name).slice(0, 120)} ${String(args.question || 'company overview').slice(0, 160)}`;
    const web = await tavilySearch(ctx.req.sb, ctx.req.orgId, query, { maxResults: 5, answer: false });
    const rows = web.results.map((r) => ({
      org_id: ctx.req.orgId, kind: 'tavily', url: r.url, title: r.title.slice(0, 200), content: r.content,
      content_hash: createHash('sha256').update(r.content).digest('hex'),
    }));
    const { data: saved } = rows.length ? await ctx.req.sb.from('sources').insert(rows).select('id,url') : { data: [] as any[] };
    const items = web.results.map((r, i) => ({ source_id: saved?.[i]?.id, title: r.title, url: r.url, text: cleanText(r.content).slice(0, 600) }));
    if (items.some((i) => screenWithPatterns(i.text).suspicious)) ctx.state.tainted = true;
    return { untrusted: true, data: { query, results: items } };
  },
};
