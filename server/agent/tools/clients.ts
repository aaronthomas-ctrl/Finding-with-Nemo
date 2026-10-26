import { haversineKm, type LatLng } from '../../geo';
import { cleanText } from '../../security/untrusted';
import { resolvePlace } from './places';
import { writeMemories } from '../../memory';
import type { ToolCtx, ToolDef } from '../types';

const clip = (s: unknown, n = 200) => cleanText(String(s ?? '')).slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

/** Find a client by id or by (partial) name inside the caller's org. */
async function findClient(ctx: Pick<ToolCtx, 'req'>, ref: { client_id?: string; name?: string }) {
  let q = ctx.req.sb.from('clients').select('*').eq('org_id', ctx.req.orgId).limit(1);
  q = ref.client_id ? q.eq('id', ref.client_id) : q.ilike('name', `%${String(ref.name ?? '').replace(/[%_]/g, '')}%`);
  const { data } = await q;
  return data?.[0] ?? null;
}

const compact = (c: any) => ({
  id: c.id, name: clip(c.name, 100), tier: c.tier, status: c.status, category: c.category, tags: c.tags,
  region: c.region, next_follow_up: c.next_follow_up, last_contacted_at: c.last_contacted_at,
});

export const findNearbySavedClients: ToolDef = {
  name: 'find_nearby_saved_clients',
  write: false,
  description: 'List saved clients within a radius of a place, a client, or the current map selection.',
  parameters: {
    type: 'object',
    properties: {
      place: { type: 'string', description: 'A place name' },
      client_id: { type: 'string' },
      radius_km: { type: 'number', description: 'Default 5' },
    },
  },
  async run(args, ctx) {
    let center: LatLng | null = null;
    let label = '';
    if (args.client_id) {
      const c = await findClient(ctx, { client_id: args.client_id });
      if (c?.lat != null) { center = { lat: c.lat, lng: c.lng }; label = c.name; }
    } else if (args.place) {
      const p = await resolvePlace(ctx, String(args.place), ctx.org.country);
      center = p.center; label = p.name;
    } else if (ctx.ui.place) { center = ctx.ui.place.location; label = ctx.ui.place.name; }
    else if (ctx.ui.polygon?.length) {
      center = { lat: ctx.ui.polygon.reduce((a, p) => a + p.lat, 0) / ctx.ui.polygon.length, lng: ctx.ui.polygon.reduce((a, p) => a + p.lng, 0) / ctx.ui.polygon.length };
      label = 'the drawn area';
    }
    if (!center) return { data: { error: 'Say which place or client to search around.' } };
    const radius = Math.min(100, Number(args.radius_km) || 5);
    const { data } = await ctx.req.sb.from('clients').select('*').eq('org_id', ctx.req.orgId).not('lat', 'is', null).limit(3000);
    const near = (data ?? [])
      .map((c: any) => ({ c, d: haversineKm(center!, { lat: c.lat, lng: c.lng }) }))
      .filter((x) => x.d <= radius).sort((a, b) => a.d - b.d).slice(0, 25);
    return {
      untrusted: true,
      data: { around: label, radius_km: radius, count: near.length, clients: near.map((x) => ({ ...compact(x.c), distance_km: Math.round(x.d * 10) / 10 })) },
      ui: [{ type: 'show_nearby', clientIds: near.map((x) => x.c.id), center, radiusKm: radius }],
    };
  },
};

export const getClient: ToolDef = {
  name: 'get_client',
  write: false,
  description: 'Get one saved client with recent interactions. Phone numbers and emails are never returned.',
  parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' } } },
  async run(args, ctx) {
    const c = await findClient(ctx, args);
    if (!c) return { data: { error: 'No matching client.' } };
    const [{ data: ints }, { data: leads }] = await Promise.all([
      ctx.req.sb.from('interactions').select('kind,summary,occurred_at').eq('client_id', c.id).order('occurred_at', { ascending: false }).limit(5),
      ctx.req.sb.from('leads').select('title,stage,value').eq('client_id', c.id).limit(5),
    ]);
    return {
      untrusted: true,
      data: { ...compact(c), address: clip(c.address), website: c.website, territory_status: c.territory_status, interactions: (ints ?? []).map((i) => ({ ...i, summary: clip(i.summary, 240) })), leads: leads ?? [] },
    };
  },
};

export const whatsDueToday: ToolDef = {
  name: 'whats_due_today',
  write: false,
  description: 'List clients whose follow-up is due today or overdue, most important first.',
  parameters: { type: 'object', properties: { limit: { type: 'number' } } },
  async run(args, ctx) {
    const { data } = await ctx.req.sb.from('clients').select('*').eq('org_id', ctx.req.orgId)
      .or(`next_follow_up.lte.${today()},retry_flag.eq.true`).order('tier', { ascending: true }).order('next_follow_up', { ascending: true }).limit(Math.min(50, Number(args.limit) || 25));
    return { untrusted: true, data: { date: today(), count: data?.length ?? 0, clients: (data ?? []).map(compact) } };
  },
};

const EDITABLE = ['status', 'tier', 'category', 'tags', 'next_follow_up', 'website', 'territory_status'] as const;

export const updateClient: ToolDef = {
  name: 'update_client',
  write: true,
  description: 'Propose changes to a saved client: status, tier (1-4), category, tags, next_follow_up (YYYY-MM-DD), website.',
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string' }, name: { type: 'string' },
      changes: { type: 'object', properties: { status: { type: 'string' }, tier: { type: 'number' }, category: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, next_follow_up: { type: 'string' }, website: { type: 'string' } } },
    },
    required: ['changes'],
  },
  async run(args, ctx) {
    const c = await findClient(ctx, args);
    if (!c) return { data: { error: 'No matching client.' } };
    const changes: Record<string, unknown> = {};
    for (const k of EDITABLE) if (args.changes?.[k] !== undefined) changes[k] = args.changes[k];
    if (changes.tier !== undefined && ![1, 2, 3, 4].includes(Number(changes.tier))) return { data: { error: 'Tier must be 1 to 4.' } };
    if (!Object.keys(changes).length) return { data: { error: 'Nothing to change.' } };
    return { data: { proposed: true }, proposal: { summary: `Update ${c.name}: ${Object.entries(changes).map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')}`, payload: { client_id: c.id, changes } } };
  },
  async apply(payload, { req }) {
    const { error } = await req.sb.from('clients').update(payload.changes).eq('id', payload.client_id).eq('org_id', req.orgId);
    if (error) throw new Error(error.message);
    return { message: 'Client updated.' };
  },
};

export const logInteraction: ToolDef = {
  name: 'log_interaction',
  write: true,
  description: 'Propose logging a call, visit, email, message or note against a client. Also sets the next follow-up from the tier cadence.',
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string' }, name: { type: 'string' },
      kind: { type: 'string', enum: ['call', 'visit', 'email', 'message', 'note'] },
      summary: { type: 'string' },
    },
    required: ['kind', 'summary'],
  },
  async run(args, ctx) {
    const c = await findClient(ctx, args);
    if (!c) return { data: { error: 'No matching client.' } };
    return { data: { proposed: true }, proposal: { summary: `Log a ${args.kind} with ${c.name}: "${clip(args.summary, 140)}"`, payload: { client_id: c.id, kind: args.kind, summary: clip(args.summary, 1000), tier: c.tier } } };
  },
  async apply(payload, { req, org }) {
    const { error } = await req.sb.from('interactions').insert({ org_id: req.orgId, client_id: payload.client_id, user_id: req.user.id, kind: payload.kind, summary: payload.summary });
    if (error) throw new Error(error.message);
    const cadence = Number(org.config.cadence_days?.[String(payload.tier || 4)] ?? 30);
    await req.sb.from('clients').update({ last_contacted_at: new Date().toISOString(), next_follow_up: addDays(cadence), retry_flag: false }).eq('id', payload.client_id).eq('org_id', req.orgId);
    // The user's own words are the source, so this memory is verified.
    const { data: cl } = await req.sb.from('clients').select('name').eq('id', payload.client_id).maybeSingle();
    await writeMemories({ sb: req.sb, orgId: req.orgId }, [{ kind: 'interaction', content: `${payload.kind} with ${cl?.name ?? 'client'}: ${payload.summary}`, verified: true, clientId: payload.client_id }]).catch(() => {});
    return { message: `Logged. Next follow-up in ${cadence} days.` };
  },
};

export const setFollowUp: ToolDef = {
  name: 'set_follow_up',
  write: true,
  description: 'Propose a follow-up date for a client.',
  parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'] },
  async run(args, ctx) {
    const c = await findClient(ctx, args);
    if (!c) return { data: { error: 'No matching client.' } };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return { data: { error: 'Date must be YYYY-MM-DD.' } };
    return { data: { proposed: true }, proposal: { summary: `Follow up with ${c.name} on ${args.date}`, payload: { client_id: c.id, date: args.date } } };
  },
  async apply(payload, { req }) {
    const { error } = await req.sb.from('clients').update({ next_follow_up: payload.date }).eq('id', payload.client_id).eq('org_id', req.orgId);
    if (error) throw new Error(error.message);
    return { message: `Follow-up set for ${payload.date}.` };
  },
};

export const addLead: ToolDef = {
  name: 'add_lead',
  write: true,
  description: 'Propose adding a lead (an opportunity) to a client.',
  parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' }, title: { type: 'string' }, value: { type: 'number' } }, required: ['title'] },
  async run(args, ctx) {
    const c = await findClient(ctx, args);
    if (!c) return { data: { error: 'No matching client.' } };
    return { data: { proposed: true }, proposal: { summary: `Add lead "${clip(args.title, 80)}" to ${c.name}${args.value ? ` (value ${args.value})` : ''}`, payload: { client_id: c.id, title: clip(args.title, 160), value: args.value ?? null } } };
  },
  async apply(payload, { req }) {
    const { error } = await req.sb.from('leads').insert({ org_id: req.orgId, client_id: payload.client_id, owner_id: req.user.id, title: payload.title, value: payload.value });
    if (error) throw new Error(error.message);
    return { message: 'Lead added.' };
  },
};
