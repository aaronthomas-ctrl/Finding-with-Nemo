import { apiFetch } from './api';
import { calculateDistanceKm } from './geo';

export interface RouteStop {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  phone?: string;
  status?: string;
  tier?: number;
  notes?: string;
  isStartingPoint?: boolean;
}

export interface RouteLeg {
  fromStopId: string;
  toStopId: string;
  distanceKm: number;
  durationMinutes: number;
  startAddress?: string;
  endAddress?: string;
}

export interface OptimizedRouteResult {
  orderedStops: RouteStop[];
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  savingsKm?: number;
  polylinePath: google.maps.LatLngLiteral[];
  googleMapsNavUrl: string;
}

/**
 * Decodes Google Maps Encoded Polyline Algorithm string into LatLng points
 */
export function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  if (!encoded) return [];
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * Nearest-Neighbor + 2-Opt TSP algorithm for optimal sequence ordering
 */
export function solveTSPSequence(
  origin: RouteStop,
  intermediateStops: RouteStop[],
  roundTrip: boolean = false
): RouteStop[] {
  if (intermediateStops.length <= 1) {
    return [origin, ...intermediateStops, ...(roundTrip ? [origin] : [])];
  }

  // 1. Greedy Nearest Neighbor
  const remaining = [...intermediateStops];
  const ordered: RouteStop[] = [origin];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let minDist = calculateDistanceKm(current.lat, current.lng, remaining[0].lat, remaining[0].lng);

    for (let i = 1; i < remaining.length; i++) {
      const d = calculateDistanceKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    current = remaining.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }

  // 2. 2-Opt Improvement for intermediate points (excluding fixed origin at 0)
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  const calculateTotalDist = (route: RouteStop[]) => {
    let sum = 0;
    for (let i = 0; i < route.length - 1; i++) {
      sum += calculateDistanceKm(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
    }
    if (roundTrip && route.length > 1) {
      sum += calculateDistanceKm(route[route.length - 1].lat, route[route.length - 1].lng, route[0].lat, route[0].lng);
    }
    return sum;
  };

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < ordered.length - 1; i++) {
      for (let k = i + 1; k < ordered.length; k++) {
        // Test reversing segment from i to k
        const currentDist = calculateTotalDist(ordered);
        const newRoute = [
          ...ordered.slice(0, i),
          ...ordered.slice(i, k + 1).reverse(),
          ...ordered.slice(k + 1)
        ];
        const newDist = calculateTotalDist(newRoute);

        if (newDist < currentDist - 0.05) {
          ordered.splice(0, ordered.length, ...newRoute);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  if (roundTrip) {
    ordered.push(origin);
  }

  return ordered;
}

/**
 * Builds universal Google Maps Navigation URL for mobile/desktop turn-by-turn navigation
 */
export function buildGoogleMapsNavUrl(orderedStops: RouteStop[]): string {
  if (orderedStops.length < 2) return 'https://www.google.com/maps';

  const origin = `${orderedStops[0].lat},${orderedStops[0].lng}`;
  const destination = `${orderedStops[orderedStops.length - 1].lat},${orderedStops[orderedStops.length - 1].lng}`;
  const waypoints = orderedStops.slice(1, orderedStops.length - 1)
    .map(s => `${s.lat},${s.lng}`)
    .join('|');

  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  if (waypoints) {
    url.searchParams.set('waypoints', waypoints);
  }
  url.searchParams.set('travelmode', 'driving');

  return url.toString();
}

/**
 * Calculates optimized route via Server Google Directions API proxy, with client fallback
 */
export async function getOptimizedRoute(
  origin: RouteStop,
  intermediateStops: RouteStop[],
  roundTrip: boolean = false
): Promise<OptimizedRouteResult> {
  const unoptimizedDistance = (function() {
    let d = 0;
    const all = [origin, ...intermediateStops, ...(roundTrip ? [origin] : [])];
    for (let i = 0; i < all.length - 1; i++) {
      d += calculateDistanceKm(all[i].lat, all[i].lng, all[i + 1].lat, all[i + 1].lng);
    }
    return Math.round(d * 10) / 10;
  })();

  // 1. Try Google Directions optimization via API
  try {
    const res = await apiFetch('/api/optimize-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: roundTrip ? { lat: origin.lat, lng: origin.lng } : undefined,
        waypoints: intermediateStops.map(s => ({ lat: s.lat, lng: s.lng, id: s.id })),
        roundTrip
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.waypoint_order) {
        // Re-order intermediate stops according to Google's optimal sequence
        const optimalIntermediates = data.waypoint_order.map((idx: number) => intermediateStops[idx]);
        const orderedStops: RouteStop[] = [
          origin,
          ...optimalIntermediates,
          ...(roundTrip ? [{ ...origin, id: `${origin.id}-return`, name: `${origin.name} (Return)` }] : [])
        ];

        const polylinePath = data.overview_polyline ? decodePolyline(data.overview_polyline) : [];

        // Map legs
        const legs: RouteLeg[] = (data.legs || []).map((leg: any, idx: number) => ({
          fromStopId: orderedStops[idx]?.id || '',
          toStopId: orderedStops[idx + 1]?.id || '',
          distanceKm: Math.round(((leg.distance?.value || 0) / 1000) * 10) / 10,
          durationMinutes: Math.round((leg.duration?.value || 0) / 60),
          startAddress: leg.start_address,
          endAddress: leg.end_address
        }));

        const totalDist = data.total_distance_km || Math.round(legs.reduce((acc, l) => acc + l.distanceKm, 0) * 10) / 10;
        const totalDur = data.total_duration_minutes || legs.reduce((acc, l) => acc + l.durationMinutes, 0);

        return {
          orderedStops,
          legs,
          totalDistanceKm: totalDist,
          totalDurationMinutes: totalDur,
          savingsKm: unoptimizedDistance > totalDist ? Math.round((unoptimizedDistance - totalDist) * 10) / 10 : 0,
          polylinePath,
          googleMapsNavUrl: buildGoogleMapsNavUrl(orderedStops)
        };
      }
    }
  } catch (err) {
    console.warn('Backend route optimization request failed, falling back to local TSP solver:', err);
  }

  // 2. High-precision Algorithmic Fallback (TSP 2-Opt)
  const orderedStops = solveTSPSequence(origin, intermediateStops, roundTrip);
  const legs: RouteLeg[] = [];
  let totalDist = 0;

  for (let i = 0; i < orderedStops.length - 1; i++) {
    const from = orderedStops[i];
    const to = orderedStops[i + 1];
    const dist = calculateDistanceKm(from.lat, from.lng, to.lat, to.lng);
    // Estimated driving duration: average city/industrial speed ~45 km/h + 3 min buffer
    const duration = Math.max(3, Math.round((dist / 45) * 60) + 2);
    legs.push({
      fromStopId: from.id,
      toStopId: to.id,
      distanceKm: dist,
      durationMinutes: duration,
      startAddress: from.address,
      endAddress: to.address
    });
    totalDist += dist;
  }

  totalDist = Math.round(totalDist * 10) / 10;
  const totalDuration = legs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const polylinePath = orderedStops.map(s => ({ lat: s.lat, lng: s.lng }));

  return {
    orderedStops,
    legs,
    totalDistanceKm: totalDist,
    totalDurationMinutes: totalDuration,
    savingsKm: unoptimizedDistance > totalDist ? Math.round((unoptimizedDistance - totalDist) * 10) / 10 : 0,
    polylinePath,
    googleMapsNavUrl: buildGoogleMapsNavUrl(orderedStops)
  };
}
