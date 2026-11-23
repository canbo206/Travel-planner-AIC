/**
 * Driving routes between two points.
 *
 * With ORS_API_KEY set, uses OpenRouteService (free tier has a daily request
 * limit, which is why trips cache each Segment's geometry and only re-route
 * legs whose endpoints changed).
 *
 * Without a key, returns a straight line with an estimated road distance so
 * the app still works end to end in development and tests.
 */
import type { GeoJSONLineString } from '@roadtrip/shared';
import { env } from '../env.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteLeg {
  geometry: GeoJSONLineString;
  distanceM: number;
  durationS: number;
  isEstimate: boolean;
}

const EARTH_RADIUS_M = 6_371_000;
/** Roads are longer than the straight line; 1.3 is a common rule of thumb. */
const ROAD_FACTOR = 1.3;
const ESTIMATE_SPEED_MPS = 80_000 / 3600; // 80 km/h

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function estimateLeg(from: LatLng, to: LatLng): RouteLeg {
  const distanceM = Math.round(haversineMeters(from, to) * ROAD_FACTOR);
  return {
    geometry: {
      type: 'LineString',
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    },
    distanceM,
    durationS: Math.round(distanceM / ESTIMATE_SPEED_MPS),
    isEstimate: true,
  };
}

interface OrsResponse {
  features?: {
    geometry: GeoJSONLineString;
    properties: { summary?: { distance?: number; duration?: number } };
  }[];
}

async function orsLeg(from: LatLng, to: LatLng): Promise<RouteLeg> {
  const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
    method: 'POST',
    headers: { Authorization: env.ORS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OpenRouteService responded ${res.status}`);
  const data = (await res.json()) as OrsResponse;
  const feature = data.features?.[0];
  if (!feature) throw new Error('OpenRouteService returned no route');
  return {
    geometry: feature.geometry,
    distanceM: Math.round(feature.properties.summary?.distance ?? 0),
    durationS: Math.round(feature.properties.summary?.duration ?? 0),
    isEstimate: false,
  };
}

/**
 * Route one leg. Falls back to an estimate if the provider fails, so a flaky
 * routing API never blocks someone from saving their trip.
 */
export async function routeLeg(from: LatLng, to: LatLng): Promise<RouteLeg> {
  if (!env.ORS_API_KEY) return estimateLeg(from, to);
  try {
    return await orsLeg(from, to);
  } catch (err) {
    console.warn('Routing failed, using estimate:', (err as Error).message);
    return estimateLeg(from, to);
  }
}

/** Cache key for a leg: same endpoints means the same route. */
export function legKey(from: LatLng, to: LatLng): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}`;
}
