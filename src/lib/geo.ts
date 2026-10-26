export function pointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]) {
  const x = point.lng;
  const y = point.lat;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;

    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}


export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place
}

export interface PresetRegion {
  name: string;
  region: string;
  lat: number;
  lng: number;
  description: string;
}


export function createGeoCirclePoints(
  center: { lat: number; lng: number },
  radiusKm: number,
  numPoints = 48
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const d2r = Math.PI / 180;
  const r2d = 180 / Math.PI;
  const earthRadiusKm = 6371;
  const rLat = (radiusKm / earthRadiusKm) * r2d;
  const rLng = rLat / Math.cos(center.lat * d2r);

  for (let i = 0; i < numPoints; i++) {
    const theta = (Math.PI * 2 * i) / numPoints;
    points.push({
      lat: center.lat + rLat * Math.sin(theta),
      lng: center.lng + rLng * Math.cos(theta),
    });
  }
  return points;
}

