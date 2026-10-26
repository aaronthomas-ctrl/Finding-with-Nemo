import { chatJson } from '../../llm';
import { tokenSink } from '../../usage';
import { classifyText, readWebsite } from '../../routes/enrich';
import type { ToolDef } from '../types';

const slug = (s: unknown) => String(s ?? '').toLowerCase().trim().slice(0, 40);

export const suggestSearchTags: ToolDef = {
  name: 'suggest_search_tags',
  write: false,
  description: 'Work out search tags and Google Places keywords from the business profile, or from what an individual says they are looking for. Does not save anything.',
  parameters: {
    type: 'object',
    properties: { goal: { type: 'string', description: 'What the user wants to find, in their words' } },
    required: ['goal'],
  },
  async run(args, ctx) {
    const known = ctx.org.tags.map((t) => t.name);
    const out = await chatJson<{ tags: Array<{ name: string; description: string; keywords: string[]; color?: string }>; search_keywords: string[] }>({
      role: 'nano',
      maxTokens: 700,
      onUsage: tokenSink(ctx.req.sb, ctx.req.orgId),
      messages: [
        {
          role: 'system',
          content: `You turn a sales goal into tags for finding prospects on a map.
${ctx.org.kind === 'personal' ? `The user is looking for: ${ctx.org.lookingFor ?? 'unspecified'}.` : `The user's business: ${ctx.org.summary ?? ctx.org.name}.`}
Existing tags: ${known.join(', ') || 'none'}.
Return JSON {"tags":[{"name":"short lowercase tag","description":"what it means","keywords":["words found on such a business website"],"color":"#rrggbb"}],"search_keywords":["3-6 phrases to type into a maps search"]}.
Tags describe the kind of business to look for, not the user's own products. Reuse an existing tag name when it fits. 3-6 tags.`,
        },
        { role: 'user', content: String(args.goal).slice(0, 800) },
      ],
    });
    const tags = (out.tags || []).slice(0, 8).map((t) => ({
      name: slug(t.name), description: String(t.description || '').slice(0, 200),
      keywords: (t.keywords || []).slice(0, 10).map(String), color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color! : '#6b7280',
      isNew: !known.includes(slug(t.name)),
    })).filter((t) => t.name);
    return { data: { tags, search_keywords: (out.search_keywords || []).slice(0, 6) } };
  },
};

export const applySearchTags: ToolDef = {
  name: 'apply_search_tags',
  write: true,
  description: 'Propose adding new tags to the organisation. Only tags the user will approve are saved.',
  parameters: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } }, color: { type: 'string' } }, required: ['name'] },
      },
    },
    required: ['tags'],
  },
  async run(args, ctx) {
    const known = new Set(ctx.org.tags.map((t) => t.name));
    const fresh = (args.tags || []).map((t: any) => ({ ...t, name: slug(t.name) })).filter((t: any) => t.name && !known.has(t.name));
    if (!fresh.length) return { data: { note: 'All of those tags already exist.' } };
    return {
      data: { proposed: fresh.length },
      proposal: { summary: `Add ${fresh.length} tag${fresh.length === 1 ? '' : 's'}: ${fresh.map((t: any) => t.name).join(', ')}`, payload: { tags: fresh } },
    };
  },
  async apply(payload, { req }) {
    const rows = (payload.tags || []).map((t: any) => ({
      org_id: req.orgId, name: slug(t.name), description: t.description || null, keywords: (t.keywords || []).map(String),
      color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '#6b7280', origin: 'agent', status: 'approved',
    }));
    const { error } = await req.sb.from('tag_definitions').upsert(rows, { onConflict: 'org_id,name' });
    if (error) throw new Error(error.message);
    return { message: `Added ${rows.length} tag${rows.length === 1 ? '' : 's'}.` };
  },
};

export const autoTagBatch: ToolDef = {
  name: 'auto_tag_batch',
  write: true,
  description: 'Read the websites of saved clients and propose tags and a tier for each, using only quotes found on the page.',
  parameters: {
    type: 'object',
    properties: { client_ids: { type: 'array', items: { type: 'string' }, description: 'Up to 20 client ids. Omit to use untagged clients with a website.' } },
  },
  async run(args, ctx) {
    let q = ctx.req.sb.from('clients').select('id,name,website,tags').eq('org_id', ctx.req.orgId).not('website', 'is', null).limit(20);
    q = args.client_ids?.length ? q.in('id', args.client_ids.slice(0, 20)) : q.eq('tags', '{}');
    const { data: clients } = await q;
    const queue = [...(clients ?? [])];
    const proposals: any[] = [];
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          const site = await readWebsite(c.website);
          const r = await classifyText(ctx.req, ctx.org, site.text, site.url);
          if (r.suspicious) ctx.state.tainted = true;
          if (r.tags.length || r.tier !== 4) proposals.push({ client_id: c.id, name: c.name, tags: r.tags, tier: r.tier, category: r.category, evidence: r.evidence.filter((e) => e.verified).slice(0, 3) });
        } catch { /* unreachable site: skip */ }
      }
    }));
    if (!proposals.length) return { data: { note: 'Nothing to tag: no reachable websites or no matching tags.' }, untrusted: true };
    return {
      untrusted: true,
      data: { proposals: proposals.map((p) => ({ client_id: p.client_id, name: p.name, tags: p.tags, tier: p.tier })) },
      proposal: { summary: `Tag ${proposals.length} client${proposals.length === 1 ? '' : 's'} from their websites`, bulk: proposals.length > 10, payload: { proposals } },
    };
  },
  async apply(payload, { req }) {
    let n = 0;
    for (const p of payload.proposals || []) {
      const { error } = await req.sb.from('clients').update({ tags: p.tags, tier: p.tier, category: p.category }).eq('id', p.client_id).eq('org_id', req.orgId);
      if (!error) n++;
    }
    return { message: `Updated ${n} client${n === 1 ? '' : 's'}.` };
  },
};
