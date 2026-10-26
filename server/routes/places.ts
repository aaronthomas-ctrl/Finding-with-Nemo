import { Router } from 'express';
import type { AuthedRequest } from '../auth';
import { config } from '../config';
import { assertWithinQuota, addUsage } from '../usage';

/**
 * Google Maps proxy. Results are returned to the browser and held in memory only.
 * Nothing from Places is written to the database until the user saves a client
 * (then only place_id plus the fields the user confirms; coordinates come from the Geocoding API).
 */
export const places = Router();

const PLACES = 'https://places.googleapis.com/v1/places:searchText';

export async function placesCall(req: AuthedRequest, fieldMask: string, body: Record<string, unknown>) {
  await assertWithinQuota(req.sb, req.orgId, 'google');
  const r = await fetch(PLACES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': config.googleKey, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  await addUsage(req.sb, req.orgId, { google: 1 });
  if (!r.ok) throw new Error(`Places request failed (${r.status})`);
  return r.json();
}

/** administrative_area_level_1 from a Places address, so no region list is hard-coded. */
export function regionFromComponents(components: any[] | undefined): string {
  const c = components?.find((x) => x.types?.includes('administrative_area_level_1'));
  return c?.longText || c?.shortText || '';
}

places.post('/places-search', async (req, res) => {
  const r = req as AuthedRequest;
  try {
    const { textQuery, locationRestriction, pageToken } = req.body;
    const data = await placesCall(r,
      'places.id,places.displayName,places.primaryTypeDisplayName,places.businessStatus,places.googleMapsUri,places.formattedAddress,places.location,places.addressComponents,nextPageToken',
      { textQuery: textQuery || 'business', locationRestriction, pageSize: 20, ...(pageToken ? { pageToken } : {}) });
    res.json(data);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to search places' });
  }
});

/** Find a named place or area (used by the search bar and the agent). `country` biases results; it is never forced. */
places.post('/geocode-place', async (req, res) => {
  const r = req as AuthedRequest;
  const { query, country } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) return res.status(400).json({ error: 'Query is required' });
  try {
    const textQuery = country && !query.toLowerCase().includes(String(country).toLowerCase())
      ? `${query.trim()}, ${country}` : query.trim();
    const data = await placesCall(r,
      'places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.types',
      { textQuery, pageSize: 6 });
    res.json({
      places: (data.places || []).map((p: any) => ({
        id: p.id,
        name: p.displayName?.text || query,
        formattedAddress: p.formattedAddress || '',
        location: { lat: p.location?.latitude || 0, lng: p.location?.longitude || 0 },
        viewport: p.viewport
          ? { low: { lat: p.viewport.low.latitude, lng: p.viewport.low.longitude }, high: { lat: p.viewport.high.latitude, lng: p.viewport.high.longitude } }
          : null,
        types: p.types || [],
      })),
    });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to geocode place' });
  }
});

/**
 * Geocoding API: the one Google source whose lat/lng and address may be kept (Maps Service Terms B.6.3.2).
 * Used when a place is saved as a client. Returns the region from administrative_area_level_1.
 */
places.post('/geocode-address', async (req, res) => {
  const r = req as AuthedRequest;
  const { address } = req.body;
  if (!address || typeof address !== 'string') return res.status(400).json({ error: 'Address is required' });
  try {
    await assertWithinQuota(r.sb, r.orgId, 'google');
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', config.googleKey);
    const g = await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).json();
    await addUsage(r.sb, r.orgId, { google: 1 });
    const top = g.results?.[0];
    if (!top) return res.json({ found: false });
    const admin1 = top.address_components?.find((c: any) => c.types.includes('administrative_area_level_1'));
    res.json({
      found: true,
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      formattedAddress: top.formatted_address,
      region: admin1?.long_name || '',
      placeId: top.place_id,
      geoSource: 'geocoding',
    });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Geocoding failed' });
  }
});

/** Look up one company by name (Excel import). Returns candidates; the client decides what to save. */
places.post('/customer-lookup', async (req, res) => {
  const r = req as AuthedRequest;
  const { companyName, country } = req.body;
  if (!companyName || typeof companyName !== 'string') return res.status(400).json({ error: 'Company name is required.' });
  const name = companyName.trim();
  try {
    const data = await placesCall(r,
      'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.addressComponents',
      { textQuery: country ? `${name}, ${country}` : name });
    res.json({
      success: true,
      companyName: name,
      places: (data.places || []).map((p: any) => ({
        id: p.id,
        name: p.displayName?.text || name,
        originalQuery: name,
        address: p.formattedAddress || '',
        location: { latitude: p.location?.latitude ?? null, longitude: p.location?.longitude ?? null },
        phone: p.nationalPhoneNumber || '',
        website: p.websiteUri || '',
        category: p.primaryTypeDisplayName?.text || '',
        googleMapsUri: p.googleMapsUri || '',
        region: regionFromComponents(p.addressComponents),
      })),
    });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || 'Lookup failed' });
  }
});

/** Static-map images for PDF reports. Only Google Static Maps URLs are proxied. */
places.get('/proxy-image', async (req, res) => {
  try {
    const target = new URL(String(req.query.url || ''));
    if (target.protocol !== 'https:' || target.hostname !== 'maps.googleapis.com' || !target.pathname.startsWith('/maps/api/staticmap')) {
      return res.status(400).json({ error: 'Only Google Static Maps images can be proxied' });
    }
    const r = await fetch(target, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error('Failed to fetch image');
    res.set('Content-Type', r.headers.get('content-type') || 'image/png');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
