export interface LatLng { lat: number; lng: number }

export type Area =
  | { kind: 'polygon'; path: LatLng[] }
  | { kind: 'circle'; center: LatLng; radius_m: number }
  | { kind: 'rect'; low: LatLng; high: LatLng };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function pointInPolygon(p: LatLng, path: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i], b = path[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

export function boundingRect(area: Area): { low: LatLng; high: LatLng } {
  if (area.kind === 'rect') return { low: area.low, high: area.high };
  if (area.kind === 'circle') {
    const dLat = area.radius_m / 111_320;
    const dLng = area.radius_m / (111_320 * Math.max(0.2, Math.cos((area.center.lat * Math.PI) / 180)));
    return { low: { lat: area.center.lat - dLat, lng: area.center.lng - dLng }, high: { lat: area.center.lat + dLat, lng: area.center.lng + dLng } };
  }
  const lats = area.path.map((p) => p.lat), lngs = area.path.map((p) => p.lng);
  return { low: { lat: Math.min(...lats), lng: Math.min(...lngs) }, high: { lat: Math.max(...lats), lng: Math.max(...lngs) } };
}

export function inArea(p: LatLng, area: Area): boolean {
  if (area.kind === 'polygon') return pointInPolygon(p, area.path);
  if (area.kind === 'circle') return haversineKm(p, area.center) * 1000 <= area.radius_m;
  return p.lat >= area.low.lat && p.lat <= area.high.lat && p.lng >= area.low.lng && p.lng <= area.high.lng;
}

/** A circle drawn as a 32-point polygon, so the map can render it with the polygon tool. */
export function circleToPath(center: LatLng, radius_m: number, points = 32): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 2 * Math.PI;
    out.push({
      lat: center.lat + (radius_m / 111_320) * Math.sin(t),
      lng: center.lng + (radius_m / (111_320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)))) * Math.cos(t),
    });
  }
  return out;
}
