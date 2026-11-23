/**
 * The API contract shared by apps/api and apps/web.
 *
 * Request bodies are Zod schemas (the API validates with them, the web app
 * reuses them for forms). Response shapes are plain TypeScript types.
 * Change this file first, then the API, then the UI.
 */
import { z } from 'zod';

// ---------- Enums ----------

export const Visibility = z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']);
export type Visibility = z.infer<typeof Visibility>;

/** Phase 1 only uses ROAD_TRIP. GENERAL is reserved for Phase 2. */
export const TravelType = z.enum(['ROAD_TRIP', 'GENERAL']);
export type TravelType = z.infer<typeof TravelType>;

/** Mode of a leg between two stops. Phase 2 adds flights etc. without a schema rebuild. */
export const TransportMode = z.enum(['DRIVE', 'FLIGHT', 'TRAIN', 'BUS', 'FERRY', 'WALK']);
export type TransportMode = z.infer<typeof TransportMode>;

// ---------- Request schemas ----------

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const StopInput = LatLng.extend({
  /** Existing stop id to keep (and keep its photos). Omit for a new stop. */
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  dayNumber: z.number().int().min(1).max(60).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  activities: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  placeId: z.string().max(200).nullable().optional(),
});
export type StopInput = z.infer<typeof StopInput>;

export const CreateTripInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(5000).optional(),
  durationDays: z.number().int().min(1).max(60).optional(),
  travelType: TravelType.default('ROAD_TRIP'),
});
export type CreateTripInput = z.infer<typeof CreateTripInput>;

export const UpdateTripInput = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(5000).nullable().optional(),
  durationDays: z.number().int().min(1).max(60).nullable().optional(),
  visibility: Visibility.optional(),
  coverImageUrl: z.url().nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
});
export type UpdateTripInput = z.infer<typeof UpdateTripInput>;

/** PUT /trips/:id/stops replaces the whole ordered list. Array order = route order. */
export const PutStopsInput = z.object({
  stops: z.array(StopInput).max(50),
});
export type PutStopsInput = z.infer<typeof PutStopsInput>;

export const RecreateTripInput = z.object({
  startDate: z.iso.date().optional(),
});
export type RecreateTripInput = z.infer<typeof RecreateTripInput>;

export const DiscoverQuery = z.object({
  q: z.string().trim().max(100).optional(),
  minDays: z.coerce.number().int().min(1).optional(),
  maxDays: z.coerce.number().int().min(1).optional(),
  sort: z.enum(['new', 'popular']).default('new'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type DiscoverQuery = z.infer<typeof DiscoverQuery>;

export const PlaceSearchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  /** Bias results toward this point (e.g. the last stop). */
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
});

export const SignUploadInput = z.object({
  tripId: z.string(),
  stopId: z.string(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export type SignUploadInput = z.infer<typeof SignUploadInput>;

export const AddPhotoInput = z.object({
  url: z.url(),
  caption: z.string().max(300).optional(),
});
export type AddPhotoInput = z.infer<typeof AddPhotoInput>;

// ---------- Response types ----------

export interface UserSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Photo {
  id: string;
  url: string;
  caption: string | null;
  uploadedBy: UserSummary;
}

export interface Stop {
  id: string;
  position: number;
  dayNumber: number | null;
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  activities: string[];
  placeId: string | null;
  photos: Photo[];
  /** Photos from the original traveler's stop, when this trip is a recreation. */
  originalPhotos: Photo[];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface Segment {
  id: string;
  fromStopId: string;
  toStopId: string;
  mode: TransportMode;
  geometry: GeoJSONLineString | null;
  distanceM: number | null;
  durationS: number | null;
  /** True when no routing provider was configured and this is a straight-line estimate. */
  isEstimate: boolean;
}

export interface TripSummary {
  id: string;
  title: string;
  description: string | null;
  owner: UserSummary;
  visibility: Visibility;
  travelType: TravelType;
  durationDays: number | null;
  stopCount: number;
  totalDistanceM: number | null;
  totalDurationS: number | null;
  recreateCount: number;
  coverImageUrl: string | null;
  /** First and last stop, for map previews. */
  startStop: { name: string; lat: number; lng: number } | null;
  endStop: { name: string; lat: number; lng: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripDetail extends TripSummary {
  startDate: string | null;
  stops: Stop[];
  segments: Segment[];
  sourceTrip: { id: string; title: string; owner: UserSummary } | null;
  isOwner: boolean;
  isSaved: boolean;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PlaceResult {
  name: string;
  label: string;
  lat: number;
  lng: number;
  placeId: string | null;
}

export interface SignedUpload {
  uploadUrl: string;
  publicUrl: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// ---------- Helpers shared by API and UI ----------

export const METERS_PER_MILE = 1609.344;

export function formatMiles(meters: number | null | undefined): string {
  if (meters == null) return '—';
  const miles = meters / METERS_PER_MILE;
  return `${miles >= 100 ? Math.round(miles).toLocaleString('en-US') : miles.toFixed(1)} mi`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}
