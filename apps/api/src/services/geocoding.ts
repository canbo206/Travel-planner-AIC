/**
 * Place search for the "Add a stop" box.
 *
 * Proxied through the API so the provider key never ships to the browser.
 * With ORS_API_KEY set, uses OpenRouteService geocoding (Pelias). Without it,
 * searches a small built-in list so local development works offline.
 */
import type { PlaceResult } from '@roadtrip/shared';
import { env } from '../env.js';

const DEV_PLACES: PlaceResult[] = [
  ['Pike Place Market', 'Seattle, WA', 47.6097, -122.3422],
  ['Space Needle', 'Seattle, WA', 47.6205, -122.3493],
  ['Olympia', 'WA', 47.0379, -122.9007],
  ['Mount Rainier National Park', 'WA', 46.88, -121.7269],
  ['Astoria Column', 'Astoria, OR', 46.1813, -123.8176],
  ['Cannon Beach', 'OR', 45.8918, -123.9615],
  ['Haystack Rock', 'Cannon Beach, OR', 45.8843, -123.9687],
  ['Ecola State Park', 'Cannon Beach, OR', 45.9206, -123.9785],
  ['Tillamook Creamery', 'Tillamook, OR', 45.4826, -123.8437],
  ['Cape Kiwanda', 'Pacific City, OR', 45.2154, -123.9718],
  ['Cape Kiwanda Brewpub', 'Pacific City, OR', 45.2148, -123.9696],
  ['Newport', 'OR', 44.6368, -124.0535],
  ['Portland', 'OR', 45.5152, -122.6784],
  ['Multnomah Falls', 'OR', 45.5762, -122.1158],
  ['Crater Lake National Park', 'OR', 42.9446, -122.109],
  ['San Francisco', 'CA', 37.7749, -122.4194],
  ['Big Sur', 'CA', 36.2704, -121.8081],
  ['Santa Barbara', 'CA', 34.4208, -119.6982],
  ['Los Angeles', 'CA', 34.0522, -118.2437],
  ['Zion National Park', 'UT', 37.2982, -113.0263],
  ['Bryce Canyon National Park', 'UT', 37.593, -112.1871],
  ['Capitol Reef National Park', 'UT', 38.367, -111.2615],
  ['Arches National Park', 'UT', 38.7331, -109.5925],
  ['Canyonlands National Park', 'UT', 38.3269, -109.8783],
  ['Las Vegas', 'NV', 36.1699, -115.1398],
].map(([name, region, lat, lng]) => ({
  name: name as string,
  label: `${name}, ${region}`,
  lat: lat as number,
  lng: lng as number,
  placeId: null,
}));

function searchDevPlaces(q: string): PlaceResult[] {
  const needle = q.toLowerCase();
  return DEV_PLACES.filter((p) => p.label.toLowerCase().includes(needle)).slice(0, 6);
}

interface PeliasResponse {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: { name?: string; label?: string; gid?: string };
  }[];
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number }) {
  if (!env.ORS_API_KEY) return searchDevPlaces(q);

  const url = new URL('https://api.openrouteservice.org/geocode/autocomplete');
  url.searchParams.set('api_key', env.ORS_API_KEY);
  url.searchParams.set('text', q);
  url.searchParams.set('size', '6');
  if (near) {
    url.searchParams.set('focus.point.lat', String(near.lat));
    url.searchParams.set('focus.point.lon', String(near.lng));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as PeliasResponse;
  return (data.features ?? []).map<PlaceResult>((f) => ({
    name: f.properties.name ?? f.properties.label ?? q,
    label: f.properties.label ?? f.properties.name ?? q,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    placeId: f.properties.gid ?? null,
  }));
}
