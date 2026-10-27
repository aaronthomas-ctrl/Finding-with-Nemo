import { chatJson } from '../../llm';
import { tokenSink, assertWithinQuota, addUsage } from '../../usage';
import { haversineKm, type LatLng } from '../../geo';
import { optimizeWithDirections } from '../../routes/route';
import { resolvePlace } from './places';
import type { ToolDef } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

export const planRoute: ToolDef = {
  name: 'plan_route',
  write: true,
  description: 'Plan a visiting route. Picks the stops from what is due, what is nearby and priority, then Google orders them. Returns a route for the user to approve and open.',
  parameters: {
    type: 'object',
    properties: {
      client_ids: { type: 'array', items: { type: 'string' }, description: 'Specific clients to visit. Omit to choose from what is due.' },
      start_place: { type: 'string', description: 'Where the day starts. Omit to use the selected place or the middle of the stops.' },
      max_stops: { type: 'number', description: 'Default 8, at most 20' },
      date: { type: 'string', description: 'YYYY-MM-DD, default today' },
    },
  },
  async run(args, ctx) {
    const max = Math.min(20, Math.max(2, Number(args.max_stops) || 8));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(args.date || '') ? args.date : today();

    let q = ctx.req.sb.from('clients').select('id,name,tier,lat,lng,next_follow_up,retry_flag,address').eq('org_id', ctx.req.orgId).not('lat', 'is', null);
    const ids = (args.client_ids ?? []).filter((i: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i));
    q = ids.length ? q.in('id', ids.slice(0, 40)) : q.or(`next_follow_up.lte.${date},retry_flag.eq.true`).limit(60);
    const { data: cands } = await q;
    if (!cands?.length) return { data: { error: 'No clients with a location are due. Try giving client ids or save some clients first.' } };

    let start: LatLng | null = null;
    let startLabel = '';
    if (args.start_place) { const p = await resolvePlace(ctx, String(args.start_place), ctx.org.country); start = p.center; startLabel = p.name; }
    else if (ctx.ui.place) { start = ctx.ui.place.location; startLabel = ctx.ui.place.name; }
    if (!start) {
      start = { lat: cands.reduce((a, c) => a + c.lat, 0) / cands.length, lng: cands.reduce((a, c) => a + c.lng, 0) / cands.length };
      startLabel = 'the middle of the stops';
    }

    let chosen = cands;
    let reason = 'All requested stops.';
    if (cands.length > max) {
      const list = cands.map((c) => ({ id: c.id, name: c.name, tier: c.tier, due: c.next_follow_up, retry: c.retry_flag, km: Math.round(haversineKm(start!, c) * 10) / 10 }));
      const pick = await chatJson<{ stop_ids: string[]; reason: string }>({
        role: 'nano', maxTokens: 600, onUsage: tokenSink(ctx.req.sb, ctx.req.orgId),
        messages: [
          { role: 'system', content: `Choose at most ${max} clients for one day of visits. Prefer low tier numbers (1 is most valuable), overdue follow-ups, retry flags, and clients close to each other and to the start. Return JSON {"stop_ids":["..."],"reason":"one sentence"}. Use only ids from the list.` },
          { role: 'user', content: JSON.stringify(list) },
        ],
      });
      const ids = new Set((pick.stop_ids || []).slice(0, max));
      chosen = cands.filter((c) => ids.has(c.id));
      if (chosen.length < 2) chosen = [...cands].sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || haversineKm(start!, a) - haversineKm(start!, b)).slice(0, max);
      reason = pick.reason || reason;
    }

    await assertWithinQuota(ctx.req.sb, ctx.req.orgId, 'google');
    const dir = await optimizeWithDirections(start, chosen.map((c) => ({ lat: c.lat, lng: c.lng })), { roundTrip: true });
    await addUsage(ctx.req.sb, ctx.req.orgId, { google: 1 });
    if (!dir.ok) return { data: { error: `Google could not plan this route: ${dir.message}` } };

    const ordered = dir.waypointOrder.map((i) => chosen[i]);
    const stops = ordered.map((c, i) => ({ client_id: c.id, name: c.name, seq: i + 1, leg_distance_m: dir.legs[i]?.distance?.value ?? null, leg_duration_s: dir.legs[i]?.duration?.value ?? null }));
    const km = Math.round(dir.totalDistanceM / 100) / 10;
    const mins = Math.round(dir.totalDurationS / 60);
    const clientIds = ordered.map((c) => c.id);

    return {
      untrusted: true,
      data: { start: startLabel, why_these_stops: reason, total_km: km, total_minutes: mins, stops: stops.map((s) => ({ seq: s.seq, id: s.client_id, name: s.name })) },
      ui: [{ type: 'open_route', clientIds }],
      proposal: {
        summary: `Save route for ${date}: ${stops.length} stops, ${km} km, about ${mins} min`,
        payload: { name: `Route ${date}`, date, polyline: dir.polyline, total_distance_m: dir.totalDistanceM, total_duration_s: dir.totalDurationS, stops },
      },
    };
  },
  async apply(payload, { req }) {
    const { data: route, error } = await req.sb.from('routes').insert({
      org_id: req.orgId, user_id: req.user.id, name: payload.name, plan_date: payload.date,
      total_distance_m: payload.total_distance_m, total_duration_s: payload.total_duration_s, polyline: payload.polyline,
    }).select('id').single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await req.sb.from('route_stops').insert(payload.stops.map((s: any) => ({
      org_id: req.orgId, route_id: route.id, client_id: s.client_id, seq: s.seq, leg_distance_m: s.leg_distance_m, leg_duration_s: s.leg_duration_s,
    })));
    if (e2) throw new Error(e2.message);
    return { message: 'Route saved.', ui: [{ type: 'open_route', clientIds: payload.stops.map((s: any) => s.client_id), routeId: route.id }] };
  },
};
