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
  description: 'Plan a visiting route. Call this directly for any request to plan a route or a day of visits: it finds the due clients itself, picks the stops from what is due, what is nearby and priority, then Google orders them. Do not look up clients first. If the user means particular clients (by name, or "them", "this client", "those"), pass their ids in client_ids so the route visits exactly those. Returns a route for the user to approve and open.',
  parameters: {
    type: 'object',
    properties: {
      client_ids: { type: 'array', items: { type: 'string' }, description: 'Ids of the specific clients to visit (a list). Always set this when the user means particular clients. Omit only to choose from what is due.' },
      start_place: { type: 'string', description: 'Where the day starts. Omit to use the selected place or the middle of the stops.' },
      max_stops: { type: 'number', description: 'Default 8, at most 20' },
      round_trip: { type: 'boolean', description: 'Return to the start at the end. Default false: the route ends at the last visit.' },
      date: { type: 'string', description: 'YYYY-MM-DD, default today' },
    },
  },
  async run(args, ctx) {
    const max = Math.min(20, Math.max(2, Number(args.max_stops) || 8));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(args.date || '') ? args.date : today();

    // The start comes first: it decides which clients are "near".
    let start: LatLng | null = null;
    let startLabel = '';
    let startNamed = false;
    if (args.start_place) { const p = await resolvePlace(ctx, String(args.start_place), ctx.org.country); start = p.center; startLabel = p.name; startNamed = true; }
    else if (ctx.ui.place) { start = ctx.ui.place.location; startLabel = ctx.ui.place.name; startNamed = true; }

    const cols = 'id,name,tier,lat,lng,next_follow_up,retry_flag,address';
    // The model sometimes sends one id as a string, or a comma separated list, instead of an array.
    const ids: string[] = [...new Set(JSON.stringify(args.client_ids ?? '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [])];
    let cands: any[] | null = null;
    let basis = 'the clients you named';
    if (ids.length) {
      cands = (await ctx.req.sb.from('clients').select(cols).eq('org_id', ctx.req.orgId).not('lat', 'is', null).in('id', ids.slice(0, 40))).data;
    } else {
      cands = (await ctx.req.sb.from('clients').select(cols).eq('org_id', ctx.req.orgId).not('lat', 'is', null).or(`next_follow_up.lte.${date},retry_flag.eq.true`).limit(60)).data;
      basis = 'clients that are due';
      if (!cands?.length) {
        // Nothing is due: use the saved clients closest to the start instead of giving up.
        const all = (await ctx.req.sb.from('clients').select(cols).eq('org_id', ctx.req.orgId).not('lat', 'is', null).limit(2000)).data ?? [];
        const from = start ?? ctx.ui.place?.location ?? (all[0] ? { lat: all[0].lat, lng: all[0].lng } : null);
        if (from) { cands = all.sort((a, b) => haversineKm(from, a) - haversineKm(from, b)).filter((c) => haversineKm(from, c) <= 40).slice(0, max); basis = `the saved clients nearest ${startLabel || 'the start'}`; }
      }
    }
    if (!cands?.length) return { data: { error: 'No saved clients with a location are near there. Save some clients first, or name the clients to visit.' } };

    if (!start) {
      start = { lat: cands.reduce((a, c) => a + c.lat, 0) / cands.length, lng: cands.reduce((a, c) => a + c.lng, 0) / cands.length };
      startLabel = 'the middle of the stops';
    }

    let chosen = cands;
    let reason = `Stops chosen from ${basis}.`;
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
    // One way by default: the day starts at the start point and ends at the last visit. Google orders the stops in between,
    // and the farthest stop is the destination so the order is not forced by the list. A round trip is only used when asked.
    const roundTrip = args.round_trip === true;
    const farthest = roundTrip ? null : chosen.reduce((far, c) => (haversineKm(start!, c) > haversineKm(start!, far) ? c : far), chosen[0]);
    const middle = roundTrip ? chosen : chosen.filter((c) => c.id !== farthest!.id);
    const dir = await optimizeWithDirections(start, middle.map((c) => ({ lat: c.lat, lng: c.lng })), roundTrip ? { roundTrip: true } : { destination: { lat: farthest!.lat, lng: farthest!.lng } });
    await addUsage(ctx.req.sb, ctx.req.orgId, { google: 1 });
    if (!dir.ok) return { data: { error: `Google could not plan this route: ${dir.message}` } };

    const ordered = [...dir.waypointOrder.map((i) => middle[i]), ...(farthest ? [farthest] : [])];
    const stops = ordered.map((c, i) => ({ client_id: c.id, name: c.name, seq: i + 1, leg_distance_m: dir.legs[i]?.distance?.value ?? null, leg_duration_s: dir.legs[i]?.duration?.value ?? null }));
    const km = Math.round(dir.totalDistanceM / 100) / 10;
    const mins = Math.round(dir.totalDurationS / 60);
    const clientIds = ordered.map((c) => c.id);

    return {
      untrusted: true,
      data: { start: startLabel, why_these_stops: reason, total_km: km, total_minutes: mins, stops: stops.map((s) => ({ seq: s.seq, id: s.client_id, name: s.name })) },
      ui: [{ type: 'open_route', clientIds, ...(startNamed ? { start: { name: startLabel, lat: start.lat, lng: start.lng } } : {}) }],
      proposal: {
        summary: `Save route for ${date}: ${stops.length} stops, ${km} km, about ${mins} min`,
        payload: { name: `Route ${date}`, date, polyline: dir.polyline, total_distance_m: dir.totalDistanceM, total_duration_s: dir.totalDurationS, stops, start: startNamed ? { name: startLabel, lat: start.lat, lng: start.lng } : null },
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
    return { message: 'Route saved.', ui: [{ type: 'open_route', clientIds: payload.stops.map((s: any) => s.client_id), routeId: route.id, ...(payload.start ? { start: payload.start } : {}) }] };
  },
};
