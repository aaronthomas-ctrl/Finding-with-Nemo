import { Router } from 'express';
import type { AuthedRequest } from '../auth';
import { config } from '../config';
import { assertWithinQuota, addUsage } from '../usage';

export const route = Router();

export interface LatLng { lat: number; lng: number }

/** Google Directions with optimize:true. Google, not the model, orders the stops. */
export async function optimizeWithDirections(origin: LatLng, waypoints: LatLng[], opts: { destination?: LatLng; roundTrip?: boolean } = {}) {
  const dest = opts.destination || (opts.roundTrip ? origin : (waypoints.length ? waypoints[waypoints.length - 1] : origin));
  const via = opts.destination || opts.roundTrip ? waypoints : waypoints.slice(0, -1);
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${dest.lat},${dest.lng}`);
  if (via.length) url.searchParams.set('waypoints', `optimize:true|${via.map((w) => `${w.lat},${w.lng}`).join('|')}`);
  url.searchParams.set('key', config.googleKey);
  const data = await (await fetch(url, { signal: AbortSignal.timeout(20_000) })).json();
  if (data.status !== 'OK') return { ok: false as const, status: data.status as string, message: (data.error_message as string) || 'Directions not available' };
  const r = data.routes[0];
  const dist = r.legs.reduce((a: number, l: any) => a + (l.distance?.value || 0), 0);
  const secs = r.legs.reduce((a: number, l: any) => a + (l.duration?.value || 0), 0);
  return {
    ok: true as const,
    waypointOrder: (r.waypoint_order || []) as number[],
    polyline: (r.overview_polyline?.points || '') as string,
    legs: r.legs as any[],
    summary: (r.summary || '') as string,
    totalDistanceM: dist,
    totalDurationS: secs,
  };
}

route.post('/optimize-route', async (req, res) => {
  const r = req as AuthedRequest;
  const { origin, destination, waypoints = [], roundTrip = false } = req.body;
  if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
    return res.status(400).json({ error: 'Valid origin {lat, lng} is required.' });
  }
  try {
    await assertWithinQuota(r.sb, r.orgId, 'google');
    const out = await optimizeWithDirections(origin, waypoints, { destination, roundTrip });
    await addUsage(r.sb, r.orgId, { google: 1 });
    if (!out.ok) return res.json({ fallback: true, status: out.status, error_message: out.message });
    res.json({
      success: true,
      waypoint_order: out.waypointOrder,
      overview_polyline: out.polyline,
      legs: out.legs,
      summary: out.summary,
      total_distance_km: Math.round(out.totalDistanceM / 100) / 10,
      total_duration_minutes: Math.round(out.totalDurationS / 60),
    });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: 'Failed to optimize route', details: e.message });
  }
});
