import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { TripDetail } from '@roadtrip/shared';
import { api, as, prisma, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const STOPS = [
  { name: 'Pike Place Market, Seattle', lat: 47.6097, lng: -122.3422, dayNumber: 1, notes: 'Go before 10am' },
  { name: 'Astoria Column', lat: 46.1813, lng: -123.8176, dayNumber: 1 },
  { name: 'Cannon Beach', lat: 45.8918, lng: -123.9615, dayNumber: 2, activities: ['Haystack Rock at low tide'] },
];

async function makePublicTrip(owner = 'alex'): Promise<TripDetail> {
  const created = await as(owner).post('/trips').send({ title: 'Seattle → Oregon Coast' });
  expect(created.status).toBe(201);
  const withStops = await as(owner).put(`/trips/${created.body.id}/stops`).send({ stops: STOPS });
  expect(withStops.status).toBe(200);
  const published = await as(owner).patch(`/trips/${created.body.id}`).send({ visibility: 'PUBLIC' });
  expect(published.status).toBe(200);
  return published.body;
}

describe('create and edit a trip', () => {
  it('requires sign-in to create', async () => {
    expect((await api.post('/trips').send({ title: 'x' })).status).toBe(401);
  });

  it('validates input', async () => {
    const res = await as('alex').post('/trips').send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('creates a private trip and adds stops with routed segments', async () => {
    const created = await as('alex').post('/trips').send({ title: 'Coast trip' });
    expect(created.body).toMatchObject({ visibility: 'PRIVATE', stopCount: 0, isOwner: true });

    const res = await as('alex').put(`/trips/${created.body.id}/stops`).send({ stops: STOPS });
    const trip: TripDetail = res.body;
    expect(trip.stops.map((s) => s.name)).toEqual(STOPS.map((s) => s.name));
    expect(trip.stops[0]!.notes).toBe('Go before 10am');
    expect(trip.stops[2]!.activities).toEqual(['Haystack Rock at low tide']);
    expect(trip.segments).toHaveLength(2);
    expect(trip.segments[0]).toMatchObject({ fromStopId: trip.stops[0]!.id, toStopId: trip.stops[1]!.id });
    expect(trip.totalDistanceM).toBe(trip.segments.reduce((n, s) => n + s.distanceM!, 0));
    expect(trip.durationDays).toBe(2);
    expect(trip.startStop?.name).toBe('Pike Place Market, Seattle');
    expect(trip.endStop?.name).toBe('Cannon Beach');
  });

  it('reordering keeps stop ids and reuses cached legs', async () => {
    const trip = await makePublicTrip();
    const [a, b, c] = trip.stops;
    const original = trip.segments[0]!;

    // Reverse the last two stops; leg a→b no longer exists, but b→… legs are new.
    const res = await as('alex')
      .put(`/trips/${trip.id}/stops`)
      .send({ stops: [a, c, b].map((s) => ({ id: s!.id, name: s!.name, lat: s!.lat, lng: s!.lng })) });
    const next: TripDetail = res.body;
    expect(next.stops.map((s) => s.id)).toEqual([a!.id, c!.id, b!.id]);
    expect(next.segments).toHaveLength(2);

    // Put it back: a→b reuses the same geometry it had before.
    const back = await as('alex')
      .put(`/trips/${trip.id}/stops`)
      .send({ stops: [a, b, c].map((s) => ({ id: s!.id, name: s!.name, lat: s!.lat, lng: s!.lng })) });
    expect(back.body.segments[0].geometry).toEqual(original.geometry);
  });

  it('rejects stop ids from another trip', async () => {
    const other = await makePublicTrip('mira');
    const mine = await as('alex').post('/trips').send({ title: 'Mine' });
    const res = await as('alex')
      .put(`/trips/${mine.body.id}/stops`)
      .send({ stops: [{ ...STOPS[0], id: other.stops[0]!.id }] });
    expect(res.status).toBe(400);
  });

  it('only the owner can edit', async () => {
    const trip = await makePublicTrip('alex');
    expect((await as('mira').patch(`/trips/${trip.id}`).send({ title: 'Hacked' })).status).toBe(403);
    expect((await as('mira').put(`/trips/${trip.id}/stops`).send({ stops: [] })).status).toBe(403);
    expect((await as('mira').delete(`/trips/${trip.id}`)).status).toBe(403);
  });

  it('cannot publish a trip with fewer than two stops', async () => {
    const created = await as('alex').post('/trips').send({ title: 'Empty' });
    const res = await as('alex').patch(`/trips/${created.body.id}`).send({ visibility: 'PUBLIC' });
    expect(res.status).toBe(400);
  });
});

describe('visibility and discover', () => {
  it('private trips are hidden from others and from discover', async () => {
    const created = await as('alex').post('/trips').send({ title: 'Secret' });
    expect((await as('alex').get(`/trips/${created.body.id}`)).status).toBe(200);
    expect((await as('mira').get(`/trips/${created.body.id}`)).status).toBe(404);
    expect((await api.get(`/trips/${created.body.id}`)).status).toBe(404);
    expect((await api.get('/trips')).body.total).toBe(0);
  });

  it('unlisted trips open by link but are not on discover', async () => {
    const trip = await makePublicTrip();
    await as('alex').patch(`/trips/${trip.id}`).send({ visibility: 'UNLISTED' });
    expect((await api.get(`/trips/${trip.id}`)).status).toBe(200);
    expect((await api.get('/trips')).body.total).toBe(0);
  });

  it('discover lists public trips with search, filters and sort', async () => {
    const coast = await makePublicTrip('alex');
    const other = await as('mira').post('/trips').send({ title: 'Utah Mighty 5', durationDays: 7 });
    await as('mira')
      .put(`/trips/${other.body.id}/stops`)
      .send({
        stops: [
          { name: 'Zion National Park', lat: 37.2982, lng: -113.0263, dayNumber: 7 },
          { name: 'Arches National Park', lat: 38.7331, lng: -109.5925 },
        ],
      });
    await as('mira').patch(`/trips/${other.body.id}`).send({ visibility: 'PUBLIC' });

    const all = await api.get('/trips');
    expect(all.body.total).toBe(2);
    expect(all.body.items[0].title).toBe('Utah Mighty 5'); // newest first

    const byStopName = await api.get('/trips?q=cannon');
    expect(byStopName.body.items.map((t: TripDetail) => t.id)).toEqual([coast.id]);

    const short = await api.get('/trips?maxDays=3');
    expect(short.body.items.map((t: TripDetail) => t.id)).toEqual([coast.id]);

    await as('jordan').post(`/trips/${coast.id}/recreate`).send({});
    const popular = await api.get('/trips?sort=popular');
    expect(popular.body.items[0].id).toBe(coast.id);
  });
});

describe('recreate a trip', () => {
  it('copies stops and route into a private draft credited to the original', async () => {
    const original = await makePublicTrip('alex');
    const res = await as('mira').post(`/trips/${original.id}/recreate`).send({ startDate: '2027-06-13' });
    expect(res.status).toBe(201);
    const copy: TripDetail = res.body;

    expect(copy.id).not.toBe(original.id);
    expect(copy.owner.username).toBe('mira');
    expect(copy.visibility).toBe('PRIVATE');
    expect(copy.isOwner).toBe(true);
    expect(copy.startDate).toBe('2027-06-13');
    expect(copy.sourceTrip).toMatchObject({ id: original.id, owner: { username: 'alex' } });
    expect(copy.stops.map((s) => s.name)).toEqual(original.stops.map((s) => s.name));
    expect(copy.stops.map((s) => s.notes)).toEqual(original.stops.map((s) => s.notes));
    expect(copy.stops.every((s, i) => s.id !== original.stops[i]!.id)).toBe(true);
    expect(copy.segments.map((s) => s.geometry)).toEqual(original.segments.map((s) => s.geometry));
    expect(copy.totalDistanceM).toBe(original.totalDistanceM);

    const after = await api.get(`/trips/${original.id}`);
    expect(after.body.recreateCount).toBe(1);
  });

  it('editing the copy leaves the original untouched', async () => {
    const original = await makePublicTrip('alex');
    const copy: TripDetail = (await as('mira').post(`/trips/${original.id}/recreate`).send({})).body;

    await as('mira')
      .put(`/trips/${copy.id}/stops`)
      .send({
        stops: [
          ...copy.stops.slice(0, 2).map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })),
          { name: 'Ecola State Park', lat: 45.9206, lng: -123.9785 },
        ],
      });
    await as('mira').patch(`/trips/${copy.id}`).send({ title: 'My coast trip' });

    const orig = (await api.get(`/trips/${original.id}`)).body as TripDetail;
    expect(orig.title).toBe('Seattle → Oregon Coast');
    expect(orig.stops.map((s) => s.name)).toEqual(STOPS.map((s) => s.name));
  });

  it("shows the original traveler's photos on the copied stops", async () => {
    const original = await makePublicTrip('alex');
    await as('alex')
      .post(`/trips/${original.id}/stops/${original.stops[0]!.id}/photos`)
      .send({ url: 'https://example.com/pike.jpg', caption: 'Pike Place' });

    const copy: TripDetail = (await as('mira').post(`/trips/${original.id}/recreate`).send({})).body;
    expect(copy.stops[0]!.photos).toEqual([]);
    expect(copy.stops[0]!.originalPhotos[0]).toMatchObject({
      url: 'https://example.com/pike.jpg',
      uploadedBy: { username: 'alex' },
    });
  });

  it('cannot recreate a private trip you do not own', async () => {
    const created = await as('alex').post('/trips').send({ title: 'Secret' });
    await as('alex').put(`/trips/${created.body.id}/stops`).send({ stops: STOPS });
    expect((await as('mira').post(`/trips/${created.body.id}/recreate`).send({})).status).toBe(404);
  });

  it('recreating your own trip does not raise its popularity', async () => {
    const original = await makePublicTrip('alex');
    await as('alex').post(`/trips/${original.id}/recreate`).send({});
    expect((await api.get(`/trips/${original.id}`)).body.recreateCount).toBe(0);
  });

  it('copies survive the original being deleted', async () => {
    const original = await makePublicTrip('alex');
    const copy: TripDetail = (await as('mira').post(`/trips/${original.id}/recreate`).send({})).body;
    await as('alex').delete(`/trips/${original.id}`);
    const res = await as('mira').get(`/trips/${copy.id}`);
    expect(res.status).toBe(200);
    expect(res.body.sourceTrip).toBeNull();
    expect(res.body.stops).toHaveLength(3);
  });
});

describe('save and my trips', () => {
  it('save, list and unsave', async () => {
    const trip = await makePublicTrip('alex');
    expect((await as('mira').post(`/trips/${trip.id}/save`)).status).toBe(204);
    expect((await as('mira').get(`/trips/${trip.id}`)).body.isSaved).toBe(true);
    expect((await as('mira').get('/me/saved')).body.map((t: TripDetail) => t.id)).toEqual([trip.id]);

    expect((await as('mira').delete(`/trips/${trip.id}/save`)).status).toBe(204);
    expect((await as('mira').get('/me/saved')).body).toEqual([]);
  });

  it('my trips includes drafts and recreations', async () => {
    const trip = await makePublicTrip('alex');
    await as('mira').post('/trips').send({ title: 'Draft' });
    await as('mira').post(`/trips/${trip.id}/recreate`).send({});
    const mine = await as('mira').get('/me/trips');
    expect(mine.body).toHaveLength(2);
  });
});

describe('uploads', () => {
  it('signing an upload returns 501 when storage is not configured', async () => {
    const trip = await makePublicTrip('alex');
    const res = await as('alex')
      .post('/uploads/sign')
      .send({ tripId: trip.id, stopId: trip.stops[0]!.id, contentType: 'image/jpeg' });
    expect(res.status).toBe(501);
  });
});
