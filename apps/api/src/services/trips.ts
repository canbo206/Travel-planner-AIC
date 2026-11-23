/**
 * Trip queries and the logic behind the core features:
 * create, edit stops (with cached routes), publish, discover, recreate, save.
 */
import type {
  CreateTripInput,
  DiscoverQuery,
  GeoJSONLineString,
  Paginated,
  Photo as PhotoDTO,
  PutStopsInput,
  RecreateTripInput,
  Stop as StopDTO,
  TripDetail,
  TripSummary,
  UpdateTripInput,
  UserSummary,
} from '@roadtrip/shared';
import { Prisma, prisma } from '../lib/db.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { legKey, routeLeg, type RouteLeg } from './routing.js';

// ---------- Prisma selections ----------

const userSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;

const summaryInclude = {
  owner: { select: userSelect },
  _count: { select: { stops: true } },
  stops: {
    orderBy: { position: 'asc' },
    select: { name: true, lat: true, lng: true, photos: { take: 1, select: { url: true } } },
  },
} satisfies Prisma.TripInclude;

const photoInclude = { uploader: { select: userSelect } } satisfies Prisma.PhotoInclude;

const detailInclude = {
  owner: { select: userSelect },
  _count: { select: { stops: true } },
  stops: {
    orderBy: { position: 'asc' },
    include: {
      photos: { orderBy: { createdAt: 'asc' }, include: photoInclude },
      sourceStop: { select: { photos: { orderBy: { createdAt: 'asc' }, include: photoInclude } } },
    },
  },
  segments: true,
  sourceTrip: { select: { id: true, title: true, owner: { select: userSelect } } },
} satisfies Prisma.TripInclude;

type SummaryRow = Prisma.TripGetPayload<{ include: typeof summaryInclude }>;
type DetailRow = Prisma.TripGetPayload<{ include: typeof detailInclude }>;
type PhotoRow = Prisma.PhotoGetPayload<{ include: typeof photoInclude }>;

// ---------- Serializers ----------

const toPhoto = (p: PhotoRow): PhotoDTO => ({
  id: p.id,
  url: p.url,
  caption: p.caption,
  uploadedBy: p.uploader as UserSummary,
});

function baseSummary(t: SummaryRow | DetailRow): TripSummary {
  const first = t.stops[0];
  const last = t.stops.length > 1 ? t.stops[t.stops.length - 1] : undefined;
  const firstPhoto = t.stops.flatMap((s) => s.photos)[0]?.url ?? null;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    owner: t.owner,
    visibility: t.visibility,
    travelType: t.travelType,
    durationDays: t.durationDays,
    stopCount: t._count.stops,
    totalDistanceM: t.totalDistanceM,
    totalDurationS: t.totalDurationS,
    recreateCount: t.recreateCount,
    coverImageUrl: t.coverImageUrl ?? firstPhoto,
    startStop: first ? { name: first.name, lat: first.lat, lng: first.lng } : null,
    endStop: last ? { name: last.name, lat: last.lat, lng: last.lng } : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function toDetail(t: DetailRow, viewerId: string | undefined, isSaved: boolean): TripDetail {
  const stops: StopDTO[] = t.stops.map((s) => ({
    id: s.id,
    position: s.position,
    dayNumber: s.dayNumber,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    notes: s.notes,
    activities: s.activities,
    placeId: s.placeId,
    photos: s.photos.map(toPhoto),
    originalPhotos: s.sourceStop?.photos.map(toPhoto) ?? [],
  }));
  const order = new Map(stops.map((s) => [s.id, s.position]));
  return {
    ...baseSummary(t),
    startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
    stops,
    segments: t.segments
      .sort((a, b) => (order.get(a.fromStopId) ?? 0) - (order.get(b.fromStopId) ?? 0))
      .map((g) => ({
        id: g.id,
        fromStopId: g.fromStopId,
        toStopId: g.toStopId,
        mode: g.mode,
        geometry: g.geometry as unknown as GeoJSONLineString | null,
        distanceM: g.distanceM,
        durationS: g.durationS,
        isEstimate: g.isEstimate,
      })),
    sourceTrip: t.sourceTrip,
    isOwner: viewerId === t.ownerId,
    isSaved,
  };
}

// ---------- Access helpers ----------

/** Anyone can view PUBLIC and UNLISTED trips; PRIVATE only by the owner (404 to others). */
async function loadViewable(tripId: string, viewerId?: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: detailInclude });
  if (!trip || (trip.visibility === 'PRIVATE' && trip.ownerId !== viewerId)) {
    throw notFound('Trip not found');
  }
  return trip;
}

async function assertOwner(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  if (!trip) throw notFound('Trip not found');
  if (trip.ownerId !== userId) throw forbidden('Only the trip owner can change it');
}

// ---------- Queries ----------

export async function getTrip(tripId: string, viewerId?: string): Promise<TripDetail> {
  const trip = await loadViewable(tripId, viewerId);
  const saved = viewerId
    ? await prisma.savedTrip.findUnique({ where: { userId_tripId: { userId: viewerId, tripId } } })
    : null;
  return toDetail(trip, viewerId, Boolean(saved));
}

export async function discoverTrips(query: DiscoverQuery): Promise<Paginated<TripSummary>> {
  const { q, minDays, maxDays, sort, page, pageSize } = query;
  const where: Prisma.TripWhereInput = {
    visibility: 'PUBLIC',
    ...(minDays || maxDays ? { durationDays: { gte: minDays, lte: maxDays } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { stops: { some: { name: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.TripOrderByWithRelationInput[] =
    sort === 'popular' ? [{ recreateCount: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];

  const [rows, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: summaryInclude,
    }),
    prisma.trip.count({ where }),
  ]);
  return { items: rows.map(baseSummary), page, pageSize, total };
}

export async function listMyTrips(userId: string): Promise<TripSummary[]> {
  const rows = await prisma.trip.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
    include: summaryInclude,
  });
  return rows.map(baseSummary);
}

export async function listSavedTrips(userId: string): Promise<TripSummary[]> {
  const rows = await prisma.savedTrip.findMany({
    where: {
      userId,
      // A trip that went private after being saved disappears from the list.
      trip: { OR: [{ visibility: { not: 'PRIVATE' } }, { ownerId: userId }] },
    },
    orderBy: { createdAt: 'desc' },
    include: { trip: { include: summaryInclude } },
  });
  return rows.map((r) => baseSummary(r.trip));
}

// ---------- Mutations ----------

export async function createTrip(userId: string, input: CreateTripInput) {
  const trip = await prisma.trip.create({
    data: { ...input, ownerId: userId },
    select: { id: true },
  });
  return getTrip(trip.id, userId);
}

export async function updateTrip(tripId: string, userId: string, input: UpdateTripInput) {
  await assertOwner(tripId, userId);
  if (input.visibility && input.visibility !== 'PRIVATE') {
    const stops = await prisma.stop.count({ where: { tripId } });
    if (stops < 2) throw badRequest('Add at least two stops before sharing this trip');
  }
  const { startDate, ...rest } = input;
  await prisma.trip.update({
    where: { id: tripId },
    data: {
      ...rest,
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
    },
  });
  return getTrip(tripId, userId);
}

export async function deleteTrip(tripId: string, userId: string) {
  await assertOwner(tripId, userId);
  await prisma.trip.delete({ where: { id: tripId } });
}

/**
 * Replace the ordered stop list. Stops sent with an `id` keep their identity
 * (and photos); others are created; missing ones are deleted.
 *
 * Route legs are recomputed only where the endpoints changed: legs whose
 * coordinates match an existing segment reuse its cached geometry, so
 * reordering or editing notes never burns routing API quota.
 */
export async function putStops(tripId: string, userId: string, input: PutStopsInput) {
  await assertOwner(tripId, userId);

  const existing = await prisma.stop.findMany({ where: { tripId } });
  const existingIds = new Set(existing.map((s) => s.id));
  for (const s of input.stops) {
    if (s.id && !existingIds.has(s.id)) throw badRequest(`Stop ${s.id} does not belong to this trip`);
  }

  // Cache of already-routed legs, keyed by endpoints.
  const byId = new Map(existing.map((s) => [s.id, s]));
  const oldSegments = await prisma.segment.findMany({ where: { tripId } });
  const cache = new Map<string, RouteLeg>();
  for (const g of oldSegments) {
    const a = byId.get(g.fromStopId);
    const b = byId.get(g.toStopId);
    if (a && b && g.geometry && g.distanceM != null && g.durationS != null) {
      cache.set(legKey(a, b), {
        geometry: g.geometry as unknown as GeoJSONLineString,
        distanceM: g.distanceM,
        durationS: g.durationS,
        isEstimate: g.isEstimate,
      });
    }
  }

  // Route new/changed legs before opening the transaction (network calls).
  const legs: RouteLeg[] = [];
  for (let i = 0; i < input.stops.length - 1; i++) {
    const a = input.stops[i]!;
    const b = input.stops[i + 1]!;
    const key = legKey(a, b);
    let leg = cache.get(key);
    if (!leg) {
      leg = await routeLeg(a, b);
      cache.set(key, leg);
    }
    legs.push(leg);
  }

  const keepIds = new Set(input.stops.flatMap((s) => (s.id ? [s.id] : [])));

  await prisma.$transaction(async (tx) => {
    await tx.segment.deleteMany({ where: { tripId } });
    await tx.stop.deleteMany({ where: { tripId, id: { notIn: [...keepIds] } } });

    const ids: string[] = [];
    for (const [position, s] of input.stops.entries()) {
      const data = {
        position,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        dayNumber: s.dayNumber ?? null,
        notes: s.notes ?? null,
        activities: s.activities ?? [],
        placeId: s.placeId ?? null,
      };
      const row = s.id
        ? await tx.stop.update({ where: { id: s.id }, data, select: { id: true } })
        : await tx.stop.create({ data: { ...data, tripId }, select: { id: true } });
      ids.push(row.id);
    }

    if (legs.length) {
      await tx.segment.createMany({
        data: legs.map((leg, i) => ({
          tripId,
          fromStopId: ids[i]!,
          toStopId: ids[i + 1]!,
          mode: 'DRIVE' as const,
          geometry: leg.geometry as unknown as Prisma.InputJsonValue,
          distanceM: leg.distanceM,
          durationS: leg.durationS,
          isEstimate: leg.isEstimate,
        })),
      });
    }

    const days = input.stops.map((s) => s.dayNumber ?? 0);
    const maxDay = Math.max(0, ...days);
    await tx.trip.update({
      where: { id: tripId },
      data: {
        totalDistanceM: legs.length ? legs.reduce((n, l) => n + l.distanceM, 0) : null,
        totalDurationS: legs.length ? legs.reduce((n, l) => n + l.durationS, 0) : null,
        // Keep durationDays in sync with the highest day used, unless the owner set more.
        ...(maxDay > 0 ? { durationDays: maxDay } : {}),
      },
    });
  });

  return getTrip(tripId, userId);
}

/**
 * "Recreate Trip": deep-copy a trip's stops and cached route into the
 * viewer's account as a private draft. Photos are not copied; each copied
 * stop points at its source stop so the original traveler's photos still
 * show, credited to them.
 */
export async function recreateTrip(sourceId: string, userId: string, input: RecreateTripInput) {
  const source = await loadViewable(sourceId, userId);
  if (source.stops.length === 0) throw badRequest('This trip has no stops to copy yet');

  const newId = await prisma.$transaction(async (tx) => {
    const copy = await tx.trip.create({
      data: {
        ownerId: userId,
        title: source.title,
        description: source.description,
        travelType: source.travelType,
        visibility: 'PRIVATE',
        durationDays: source.durationDays,
        startDate: input.startDate ? new Date(input.startDate) : null,
        coverImageUrl: source.coverImageUrl,
        totalDistanceM: source.totalDistanceM,
        totalDurationS: source.totalDurationS,
        sourceTripId: source.id,
      },
      select: { id: true },
    });

    const idMap = new Map<string, string>();
    for (const s of source.stops) {
      const row = await tx.stop.create({
        data: {
          tripId: copy.id,
          position: s.position,
          dayNumber: s.dayNumber,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          placeId: s.placeId,
          notes: s.notes,
          activities: s.activities,
          sourceStopId: s.id,
        },
        select: { id: true },
      });
      idMap.set(s.id, row.id);
    }

    if (source.segments.length) {
      await tx.segment.createMany({
        data: source.segments.map((g) => ({
          tripId: copy.id,
          fromStopId: idMap.get(g.fromStopId)!,
          toStopId: idMap.get(g.toStopId)!,
          mode: g.mode,
          geometry: (g.geometry ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          distanceM: g.distanceM,
          durationS: g.durationS,
          isEstimate: g.isEstimate,
        })),
      });
    }

    // Recreating your own trip (e.g. to plan a variation) doesn't count as popularity.
    if (source.ownerId !== userId) {
      await tx.trip.update({ where: { id: source.id }, data: { recreateCount: { increment: 1 } } });
    }
    return copy.id;
  });

  return getTrip(newId, userId);
}

export async function saveTrip(tripId: string, userId: string) {
  await loadViewable(tripId, userId);
  await prisma.savedTrip.upsert({
    where: { userId_tripId: { userId, tripId } },
    update: {},
    create: { userId, tripId },
  });
}

export async function unsaveTrip(tripId: string, userId: string) {
  await prisma.savedTrip.deleteMany({ where: { userId, tripId } });
}

export async function addPhoto(
  tripId: string,
  stopId: string,
  userId: string,
  data: { url: string; caption?: string },
) {
  await assertOwner(tripId, userId);
  const stop = await prisma.stop.findFirst({ where: { id: stopId, tripId }, select: { id: true } });
  if (!stop) throw notFound('Stop not found');
  await prisma.photo.create({ data: { stopId, uploaderId: userId, url: data.url, caption: data.caption } });
  return getTrip(tripId, userId);
}

export async function deletePhoto(tripId: string, photoId: string, userId: string) {
  await assertOwner(tripId, userId);
  await prisma.photo.deleteMany({ where: { id: photoId, stop: { tripId } } });
  return getTrip(tripId, userId);
}
