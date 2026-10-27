import { checkClaim } from '../../claims';
import { extractProjectCandidates, saveProjectCandidates } from '../../projects';
import { predictForClient, savePredictions } from '../../predict';
import { tavilySearch } from '../../tavily';
import { cleanText, screenWithPatterns } from '../../security/untrusted';
import type { ToolDef } from '../types';
import { splitRef } from './clients';

export const checkClaimTool: ToolDef = {
  name: 'check_claim',
  write: false,
  description: 'Check a statement (what a client said, a competitor claim) against stored memories and the public web. Returns supported, contradicted or not_found, with the quotes found. Use it before repeating a claim as fact.',
  parameters: { type: 'object', properties: { claim: { type: 'string' }, subject: { type: 'string', description: 'The company or person it is about' } }, required: ['claim'] },
  async run(args, ctx) {
    const r = await checkClaim(ctx.req, String(args.claim), args.subject ? String(args.subject) : undefined);
    if (r.suspicious) ctx.state.tainted = true;
    return { untrusted: true, data: { verdict: r.verdict, reasoning: r.reasoning, evidence: r.evidence.map((e) => ({ source: e.url ?? e.ref, stance: e.stance, quote: e.quote, verified: e.verified })) } };
  },
};

export const extractProjects: ToolDef = {
  name: 'extract_projects',
  write: true,
  description: 'Find projects (builds, openings, tenders) and the companies involved, from text the user gives or from a public web search. Proposes saving the projects and suggests links to saved clients. Every item needs a quote found in the text.',
  parameters: { type: 'object', properties: { text: { type: 'string', description: 'Text to read' }, query: { type: 'string', description: 'Or a web search, e.g. "new cafe openings in Dubai Marina"' } } },
  async run(args, ctx) {
    let text = cleanText(String(args.text || ''));
    let url: string | undefined;
    if (!text && args.query) {
      const web = await tavilySearch(ctx.req.sb, ctx.req.orgId, String(args.query).slice(0, 200), { maxResults: 6 });
      text = web.results.map((r) => `${r.title} (${r.url})\n${r.content}`).join('\n\n');
      url = web.results[0]?.url;
    }
    if (text.length < 40) return { data: { error: 'Give some text or a search query.' } };
    if (screenWithPatterns(text).suspicious) ctx.state.tainted = true;
    const { candidates, dropped } = await extractProjectCandidates(ctx.req, text);
    if (!candidates.length) return { untrusted: true, data: { note: `No quotable projects found${dropped ? ` (${dropped} unquoted items dropped)` : ''}.` } };
    return {
      untrusted: true,
      data: { projects: candidates.map((c) => ({ name: c.name, stage: c.stage, site: c.site, companies: c.participants.map((p) => `${p.company} (${p.role})`) })) },
      proposal: {
        summary: `Save ${candidates.length} project${candidates.length === 1 ? '' : 's'}: ${candidates.map((c) => c.name).join(', ').slice(0, 160)}`,
        payload: { candidates, text: text.slice(0, 20_000), url, kind: args.query ? 'web' : 'user', projects: candidates.map((c) => ({ name: c.name })) },
      },
    };
  },
  async apply(payload, { req }) {
    const r = await saveProjectCandidates(req, payload.candidates, { text: payload.text, url: payload.url, kind: payload.kind });
    return { message: `Saved ${r.projects.filter((p) => p.created).length} new projects. ${r.proposals} suggested links to review on the Projects page.${r.unlinked.length ? ` Companies not in your clients: ${r.unlinked.slice(0, 5).join(', ')}.` : ''}` };
  },
};

export const addProject: ToolDef = {
  name: 'add_project',
  write: true,
  description: 'Propose adding a project by hand, optionally linking saved clients.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' }, site: { type: 'string' }, region: { type: 'string' }, stage: { type: 'string' }, description: { type: 'string' },
      client_ids: { type: 'array', items: { type: 'string' } }, role: { type: 'string' },
    },
    required: ['name'],
  },
  async run(args) {
    const name = cleanText(String(args.name)).slice(0, 160);
    return { data: { proposed: true }, proposal: { summary: `Add project "${name}"${args.client_ids?.length ? ` with ${args.client_ids.length} linked client(s)` : ''}`, payload: { name, site: args.site ?? null, region: args.region ?? null, stage: args.stage ?? null, description: args.description ?? null, client_ids: args.client_ids ?? [], role: args.role ?? 'other' } } };
  },
  async apply(p, { req }) {
    const ins = await req.sb.from('projects').insert({ org_id: req.orgId, name: p.name, site: p.site, region: p.region, stage: p.stage, description: p.description }).select('id').single();
    if (ins.error) throw new Error(ins.error.message);
    if (p.client_ids?.length) await req.sb.from('project_participants').insert(p.client_ids.map((cid: string) => ({ org_id: req.orgId, project_id: ins.data.id, client_id: cid, role: p.role })));
    return { message: `Project "${p.name}" added.` };
  },
};

export const predictNextNeed: ToolDef = {
  name: 'predict_next_need',
  write: true,
  description: 'Predict what a client will need next, from their buying intervals, project stages and memories. Shows the prediction with reasons; saving it needs approval.',
  parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' } } },
  async run(args, ctx) {
    let q = ctx.req.sb.from('clients').select('id,name').eq('org_id', ctx.req.orgId).limit(1);
    const ref = splitRef(args);
    q = ref.id ? q.eq('id', ref.id) : q.ilike('name', `%${String(ref.name ?? '').replace(/[%_]/g, '')}%`);
    const c = (await q).data?.[0];
    if (!c) return { data: { error: 'No matching client.' } };
    const preds = await predictForClient(ctx.req, c.id);
    if (!preds.length) return { data: { note: `Not enough data about ${c.name} to predict anything: no enquiry history, projects or memories.` } };
    return {
      untrusted: true,
      data: { client: c.name, predictions: preds.map((p) => ({ need: p.need, expected_on: p.expected_on, confidence: p.confidence, reasoning: p.reasoning, memories: p.evidence_ids.map((i) => i.slice(0, 8)) })) },
      proposal: { summary: `Save ${preds.length} prediction${preds.length === 1 ? '' : 's'} for ${c.name}: ${preds.map((p) => p.need).join('; ').slice(0, 140)}`, payload: { client_id: c.id, predictions: preds } },
    };
  },
  async apply(payload, { req }) {
    const n = await savePredictions(req, payload.client_id, payload.predictions);
    return { message: `Saved ${n} prediction${n === 1 ? '' : 's'}. See the Predictions page.` };
  },
};
