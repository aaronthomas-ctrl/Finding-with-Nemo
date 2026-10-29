import { placesCall, regionFromComponents } from '../../routes/places';
import { addUsage, assertWithinQuota } from '../../usage';
import { config } from '../../config';
import { seal } from '../../crypto';
import { boundingRect, circleToPath, inArea, type Area, type LatLng } from '../../geo';
import { cleanText, screenWithPatterns } from '../../security/untrusted';
import type { ToolCtx, ToolDef } from '../types';

const clip = (s: unknown, n = 120) => cleanText(String(s ?? '')).slice(0, n);

/** Resolve a named place to a centre and a rectangle using Places text search. */
export async function resolvePlace(ctx: Pick<ToolCtx, 'req'>, name: string, country?: string | null) {
  const data = await placesCall(ctx.req, 'places.displayName,places.location,places.viewport',
    { textQuery: country && !name.toLowerCase().includes(country.toLowerCase()) ? `${name}, ${country}` : name, pageSize: 1 });
  const p = data.places?.[0];
  if (!p) throw new Error(`Could not find "${name}"`);
  const center = { lat: p.location.latitude, lng: p.location.longitude };
  const vp = p.viewport
    ? { low: { lat: p.viewport.low.latitude, lng: p.viewport.low.longitude }, high: { lat: p.viewport.high.latitude, lng: p.viewport.high.longitude } }
    : boundingRect({ kind: 'circle', center, radius_m: 2000 });
  return { name: (p.displayName?.text as string) || name, center, rect: vp };
}

export async function resolveArea(ctx: ToolCtx, a: any): Promise<{ area: Area | null; label: string }> {
  const kind = a?.kind;
  if (kind === 'circle' && typeof a.lat === 'number' && typeof a.lng === 'number') {
    return { area: { kind: 'circle', center: { lat: a.lat, lng: a.lng }, radius_m: Math.min(50, Number(a.radius_km) || 2) * 1000 }, label: 'circle' };
  }
  if (kind === 'place' && a.name) {
    const r = await resolvePlace(ctx, String(a.name), ctx.org.country);
    return { area: { kind: 'rect', ...r.rect }, label: r.name };
  }
  if (kind === 'current_view' && ctx.ui.bounds) return { area: { kind: 'rect', ...ctx.ui.bounds }, label: 'the current map view' };
  if ((kind === 'drawn_area' || !kind) && ctx.ui.polygon?.length) return { area: { kind: 'polygon', path: ctx.ui.polygon }, label: 'the drawn area' };
  if (!kind && ctx.ui.place && ctx.ui.radiusKm) return { area: { kind: 'circle', center: ctx.ui.place.location, radius_m: Math.min(50, ctx.ui.radiusKm) * 1000 }, label: `${ctx.ui.radiusKm} km around ${ctx.ui.place.name}` };
  if (!kind && ctx.ui.bounds) return { area: { kind: 'rect', ...ctx.ui.bounds }, label: 'the current map view' };
  return { area: null, label: 'anywhere' };
}

const areaSchema = {
  type: 'object',
  description: 'Where to look. Omit to use the area the user drew, else the current map view.',
  properties: {
    kind: { type: 'string', enum: ['place', 'circle', 'drawn_area', 'current_view'] },
    name: { type: 'string', description: 'For kind=place: a district, city or landmark' },
    lat: { type: 'number' }, lng: { type: 'number' }, radius_km: { type: 'number' },
  },
};

export const searchPlaces: ToolDef = {
  name: 'search_places',
  write: false,
  description: 'Find businesses with the Google Maps Places API inside an area (the area the user drew, else the map view). Give "tags" to search by the organisation\'s tags (each tag is searched with its keywords), and/or a free "query". This is a map search, not a web search. Results are held in memory only; use save_companies to keep some.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free text, e.g. "vegan bakery"' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tag names to search for. Omit both query and tags to use the tags the user has active, else the organisation\'s own tags.' },
      area: areaSchema,
    },
  },
  async run(args, ctx) {
    const { area, label } = await resolveArea(ctx, args.area);

    // What to search for: the user's words, the tags they asked for, or the tags they have on screen.
    const defs = new Map(ctx.org.tags.map((t) => [t.name.toLowerCase(), t]));
    const wantedTags: string[] = (args.tags?.length ? args.tags : !args.query ? (ctx.ui.tags?.length ? ctx.ui.tags : ctx.org.tags.map((t) => t.name)) : []).map(String);
    const queries: Array<{ text: string; tag?: string }> = [];
    if (args.query) queries.push({ text: String(args.query).slice(0, 120) });
    for (const t of wantedTags.slice(0, 4)) {
      const d = defs.get(t.toLowerCase());
      queries.push({ text: d?.keywords?.[0] && !t.toLowerCase().includes(d.keywords[0].toLowerCase()) ? `${t} ${d.keywords[0]}` : t, tag: t });
    }
    if (!queries.length) return { data: { error: 'Say what to look for, or add some tags first.' } };

    const field = 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.addressComponents';
    const body = (text: string): any => {
      const b: any = { textQuery: text.slice(0, 120), pageSize: 20 };
      if (area) {
        const r = boundingRect(area);
        b.locationRestriction = { rectangle: { low: { latitude: r.low.lat, longitude: r.low.lng }, high: { latitude: r.high.lat, longitude: r.high.lng } } };
      }
      return b;
    };

    const merged = new Map<string, any>();
    for (const q of queries.slice(0, 5)) {
      const data = await placesCall(ctx.req, field, body(q.text));
      for (const p of (data.places || []) as any[]) {
        if (area && !inArea({ lat: p.location.latitude, lng: p.location.longitude }, area)) continue;
        const hit = merged.get(p.id) ?? { p, tags: new Set<string>() };
        if (q.tag) hit.tags.add(q.tag);
        merged.set(p.id, hit);
      }
    }
    const places = [...merged.values()];
    const placeIds = places.map((x) => x.p.id);
    const { data: saved } = placeIds.length
      ? await ctx.req.sb.from('clients').select('place_id').eq('org_id', ctx.req.orgId).in('place_id', placeIds)
      : { data: [] as any[] };
    const savedSet = new Set((saved ?? []).map((c: any) => c.place_id));

    // New search: the earlier numbered results are replaced, but anything on the user's screen (s1, s2, ...) stays saveable.
    for (const k of [...ctx.state.results.keys()]) if (k.startsWith('r')) ctx.state.results.delete(k);
    const rows = places.slice(0, 30).map(({ p, tags }, i) => {
      const id = `r${i + 1}`;
      const rec = {
        id, placeId: p.id as string, name: clip(p.displayName?.text), address: clip(p.formattedAddress, 200),
        lat: p.location.latitude as number, lng: p.location.longitude as number, category: clip(p.primaryTypeDisplayName?.text, 60),
        website: (p.websiteUri as string) || '', phone: (p.nationalPhoneNumber as string) || '', googleMapsUri: (p.googleMapsUri as string) || '',
        region: regionFromComponents(p.addressComponents), alreadySaved: savedSet.has(p.id), foundByTags: [...tags] as string[],
      };
      ctx.state.results.set(id, rec);
      return rec;
    });
    if (rows.some((r) => screenWithPatterns(`${r.name} ${r.address}`).suspicious)) ctx.state.tainted = true;

    return {
      untrusted: true,
      data: {
        searched_with: queries.map((q) => q.text), area: label, count: rows.length,
        results: rows.map((r) => ({ id: r.id, name: r.name, address: r.address, category: r.category, website: r.website || undefined, region: r.region, found_by_tags: r.foundByTags.length ? r.foundByTags : undefined, already_saved: r.alreadySaved })),
      },
      ui: [{ type: 'show_places', places: rows.map((r) => ({ id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, category: r.category, website: r.website, placeId: r.placeId, region: r.region })) }],
    };
  },
};

export const drawSearchArea: ToolDef = {
  name: 'draw_search_area',
  write: false,
  description: 'Draw an area on the map for the user: a circle around a point, a named place, or a polygon from coordinates. Changes the screen only, saves nothing.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['place', 'circle', 'polygon'] },
      name: { type: 'string', description: 'For kind=place' },
      lat: { type: 'number' }, lng: { type: 'number' }, radius_km: { type: 'number' },
      path: { type: 'array', items: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } }, required: ['lat', 'lng'] }, description: 'For kind=polygon, at least 3 points' },
    },
    required: ['kind'],
  },
  async run(args, ctx) {
    let path: LatLng[];
    let label: string;
    if (args.kind === 'polygon') {
      path = (args.path || []).filter((p: any) => typeof p?.lat === 'number' && typeof p?.lng === 'number');
      if (path.length < 3) throw new Error('A polygon needs at least 3 points');
      label = 'custom area';
    } else {
      let { lat, lng } = args;
      // "a circle around <place>": find the place first
      if (args.kind === 'circle' && (typeof lat !== 'number' || typeof lng !== 'number') && args.name) {
        const p = await resolvePlace(ctx, String(args.name), ctx.org.country);
        lat = p.center.lat; lng = p.center.lng;
      }
      const r = await resolveArea(ctx, { kind: args.kind, name: args.name, lat, lng, radius_km: args.radius_km });
      if (!r.area) throw new Error('Could not work out the area');
      label = r.label;
      const a = r.area;
      path = a.kind === 'circle' ? circleToPath(a.center, a.radius_m)
        : a.kind === 'rect' ? [a.low, { lat: a.low.lat, lng: a.high.lng }, a.high, { lat: a.high.lat, lng: a.low.lng }]
        : a.path;
    }
    ctx.state.lastArea = path;
    ctx.ui.polygon = path;
    return { data: { drawn: true, label, points: path.length }, ui: [{ type: 'draw_area', path, label }] };
  },
};

export const saveCompanies: ToolDef = {
  name: 'save_companies',
  write: true,
  description: 'Propose saving businesses from the latest search_places results into the CRM. The user approves first.',
  parameters: {
    type: 'object',
    properties: {
      result_ids: { type: 'array', items: { type: 'string' }, description: 'ids like r1, r2 from search_places, or s1, s2 for the results already on the screen' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags to put on all of them. Omit to use the tags the results were found with, or the tags the user has active.' },
    },
    required: ['result_ids'],
  },
  async run(args, ctx) {
    const picked = (args.result_ids || []).map((id: string) => ctx.state.results.get(id)).filter(Boolean).filter((r: any) => !r.alreadySaved);
    if (!picked.length) return { data: { error: 'No new results to save. Search first, or they are already saved.' } };
    const names = picked.slice(0, 5).map((r: any) => r.name).join(', ');
    const tags: string[] = [...new Set<string>([...(args.tags?.length ? args.tags : [...(ctx.ui.tags ?? []), ...picked.flatMap((r: any) => r.foundByTags ?? [])])].map((t: string) => String(t).toLowerCase().trim().slice(0, 40)).filter(Boolean))];
    // Tags the organisation does not have yet are added when the user approves, so the agent searches with them next time.
    const known = new Set(ctx.org.tags.map((t) => t.name.toLowerCase()));
    const newTags = tags.filter((t) => !known.has(t));
    return {
      data: { proposed: picked.length, tags, new_tags_to_remember: newTags },
      proposal: {
        summary: `Save ${picked.length} compan${picked.length === 1 ? 'y' : 'ies'}: ${names}${picked.length > 5 ? ` and ${picked.length - 5} more` : ''}${tags.length ? `, tagged ${tags.join(', ')}` : ''}${newTags.length ? `. Also remember the new tag${newTags.length > 1 ? 's' : ''} ${newTags.join(', ')} for future searches` : ''}`,
        bulk: picked.length > 10,
        payload: { companies: picked, tags, newTags },
      },
    };
  },
  async apply(payload, { req }) {
    const companies: any[] = payload.companies || [];
    await assertWithinQuota(req.sb, req.orgId, 'google');
    // Coordinates for saved clients come from the Geocoding API, whose results may be kept.
    const geocode = async (c: any) => {
      try {
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('address', c.address || c.name);
        url.searchParams.set('key', config.googleKey);
        const g = await (await fetch(url, { signal: AbortSignal.timeout(10_000) })).json();
        const t = g.results?.[0];
        if (t) return { lat: t.geometry.location.lat as number, lng: t.geometry.location.lng as number, source: 'geocoding' as const };
      } catch { /* fall back below */ }
      return { lat: c.lat as number, lng: c.lng as number, source: 'places' as const };
    };
    const queue = [...companies];
    const geos = new Map<string, Awaited<ReturnType<typeof geocode>>>();
    await Promise.all(Array.from({ length: 5 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) geos.set(c.placeId, await geocode(c));
    }));
    await addUsage(req.sb, req.orgId, { google: companies.length });

    const rows = companies.map((c) => {
      const g = geos.get(c.placeId)!;
      return {
        org_id: req.orgId, owner_id: req.user.id, name: c.name, normalized_name: String(c.name).toLowerCase(),
        place_id: c.placeId, address: c.address, region: c.region || null, lat: g.lat, lng: g.lng, geo_source: g.source,
        places_fetched_at: g.source === 'places' ? new Date().toISOString() : null,
        website: c.website || null, phone_enc: seal(c.phone), category: c.category || 'Other',
        tags: payload.tags || [], tier: 4, status: 'New', metadata: { googleMapsLink: c.googleMapsUri || undefined },
      };
    });
    const { data, error } = await req.sb.from('clients').upsert(rows, { onConflict: 'org_id,place_id', ignoreDuplicates: true }).select('id');
    if (error) throw new Error(error.message);
    if (payload.newTags?.length) {
      await req.sb.from('tag_definitions').upsert(payload.newTags.map((t: string) => ({ org_id: req.orgId, name: t, description: null, keywords: [t], origin: 'user', status: 'approved' })), { onConflict: 'org_id,name', ignoreDuplicates: true });
    }
    return { message: `Saved ${data?.length ?? 0} of ${rows.length} (the rest were already in the pipeline).` };
  },
};

export const saveSearchZone: ToolDef = {
  name: 'save_search_zone',
  write: true,
  description: 'Propose saving the current drawn area as a named search zone, with tags.',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
    required: ['name'],
  },
  async run(args, ctx) {
    const path = ctx.state.lastArea ?? ctx.ui.polygon;
    if (!path?.length) return { data: { error: 'There is no drawn area. Draw one first.' } };
    return {
      data: { proposed: true },
      proposal: { summary: `Save search zone "${clip(args.name, 60)}"${args.tags?.length ? ` with tags ${args.tags.join(', ')}` : ''}`, payload: { name: clip(args.name, 80), tags: args.tags || [], path } },
    };
  },
  async apply(payload, { req }) {
    const { error } = await req.sb.from('search_zones').insert({
      org_id: req.orgId, name: payload.name, tags: payload.tags || [], geometry: { type: 'polygon', path: payload.path }, created_by: req.user.id,
    });
    if (error) throw new Error(error.message);
    return { message: `Saved zone "${payload.name}".` };
  },
};
