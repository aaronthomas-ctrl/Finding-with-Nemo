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

export function extractEmirate(address = '', lat?: number | null, lng?: number | null): string {
  const addr = (address || '').toLowerCase();

  if (
    addr.includes('abu dhabi') || addr.includes('mussafah') || addr.includes('musaffah') ||
    addr.includes('icad') || addr.includes('al ain') || addr.includes('ruwais') ||
    addr.includes('khalifa port') || addr.includes('al dhafra') || addr.includes('habshan') ||
    addr.includes('أبو ظبي') || addr.includes('مصفح') || addr.includes('العين')
  ) {
    return 'Abu Dhabi';
  }

  if (
    addr.includes('dubai') || addr.includes('al quoz') || addr.includes('dip') ||
    addr.includes('dubai investment park') || addr.includes('jebel ali') || addr.includes('jafza') ||
    addr.includes('deira') || addr.includes('ras al khor') || addr.includes('al qusais') ||
    addr.includes('al barsha') || addr.includes('bur dubai') || addr.includes('dubai industrial') ||
    addr.includes('saih shuaib') || addr.includes('دبي') || addr.includes('القوز')
  ) {
    return 'Dubai';
  }

  if (
    addr.includes('sharjah') || addr.includes('sajaa') || addr.includes('al sajjah') ||
    addr.includes('hamriyah') || addr.includes('industrial area') || addr.includes('الشارقة')
  ) {
    return 'Sharjah';
  }

  if (addr.includes('ajman') || addr.includes('jurf') || addr.includes('al jurf') || addr.includes('عجمان')) {
    return 'Ajman';
  }

  if (
    addr.includes('ras al khaimah') || addr.includes('ras al-khaimah') || addr.includes('rak') ||
    addr.includes('al jazeera al hamra') || addr.includes('al hamra') || addr.includes('رأس الخيمة')
  ) {
    return 'Ras Al Khaimah';
  }

  if (addr.includes('fujairah') || addr.includes('al hayl') || addr.includes('الفجيرة')) {
    return 'Fujairah';
  }

  if (addr.includes('umm al quwain') || addr.includes('umm al-quwain') || addr.includes('uaq') || addr.includes('أم القيوين')) {
    return 'Umm Al Quwain';
  }

  // Fallback by coordinates if available
  if (lat && lng) {
    if (lat >= 25.55 && lng >= 55.8) return 'Ras Al Khaimah';
    if (lat >= 25.0 && lat <= 25.6 && lng >= 56.1) return 'Fujairah';
    if (lat >= 25.26 && lat <= 25.55 && lng >= 55.36 && lng <= 55.75) return 'Sharjah';
    if (lat >= 24.8 && lat <= 25.35 && lng >= 55.0 && lng <= 55.45) return 'Dubai';
    if (lat < 24.85 || lng < 55.0) return 'Abu Dhabi';
  }

  return 'Dubai';
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
  emirate: string;
  lat: number;
  lng: number;
  description: string;
}

export const UAE_INDUSTRIAL_REGIONS: PresetRegion[] = [
  { name: 'Mussafah Industrial Area', emirate: 'Abu Dhabi', lat: 24.3644, lng: 54.4981, description: 'Major manufacturing & oilfield fabrication hub' },
  { name: 'ICAD (Industrial City Abu Dhabi)', emirate: 'Abu Dhabi', lat: 24.3167, lng: 54.4667, description: 'Heavy industrial, steel & EPC processing' },
  { name: 'Khalifa Port & KIZAD / KEZAD', emirate: 'Abu Dhabi', lat: 24.8115, lng: 54.7214, description: 'Integrated trade, logistics & industrial zone' },
  { name: 'Jebel Ali Free Zone (JAFZA)', emirate: 'Dubai', lat: 24.9982, lng: 55.0768, description: 'Largest maritime & industrial free zone' },
  { name: 'Al Quoz Industrial Area', emirate: 'Dubai', lat: 25.1378, lng: 55.2343, description: 'Central Dubai workshops, machining & fabrication' },
  { name: 'Dubai Industrial City (DIC)', emirate: 'Dubai', lat: 24.8569, lng: 55.0683, description: 'Manufacturing & logistics hub near Al Maktoum' },
  { name: 'Dubai Investments Park (DIP)', emirate: 'Dubai', lat: 24.9856, lng: 55.1852, description: 'Mixed industrial & commercial manufacturing' },
  { name: 'Ras Al Khor Industrial', emirate: 'Dubai', lat: 25.1812, lng: 55.3524, description: 'Engineering, auto & heavy equipment workshops' },
  { name: 'Hamriyah Free Zone', emirate: 'Sharjah', lat: 25.4667, lng: 55.5000, description: 'Key petrochemical, steel fabrication & maritime yard' },
  { name: 'Sharjah Industrial Areas (10-13)', emirate: 'Sharjah', lat: 25.3090, lng: 55.4050, description: 'High-density metal, welding & spare parts trades' },
  { name: 'Al Sajaa Industrial Oasis', emirate: 'Sharjah', lat: 25.3340, lng: 55.6250, description: 'Heavy industries, scrap & large-scale yards' },
  { name: 'Al Jurf Industrial Area', emirate: 'Ajman', lat: 25.4260, lng: 55.5070, description: 'Ajman manufacturing, workshops & steel works' },
  { name: 'RAK Maritime City & Al Hamra', emirate: 'Ras Al Khaimah', lat: 25.6880, lng: 55.7890, description: 'Shipbuilding, drydocks & marine fabrication' }
];

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

