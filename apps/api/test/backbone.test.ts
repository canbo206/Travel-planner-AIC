import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { estimateLeg, haversineMeters, legKey } from '../src/services/routing.js';
import { api, as, prisma, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('backbone', () => {
  it('GET /health', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('unknown routes return JSON 404', async () => {
    const res = await api.get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('GET /me requires sign-in', async () => {
    expect((await api.get('/me')).status).toBe(401);
  });

  it('GET /me creates the user on first request', async () => {
    const res = await as('Alex').get('/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alex');
    expect(await prisma.user.count()).toBe(1);
  });

  it('GET /geo/search validates and returns places', async () => {
    expect((await api.get('/geo/search?q=a')).status).toBe(400);
    const res = await api.get('/geo/search?q=cannon');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ name: 'Cannon Beach' });
  });
});

describe('routing estimates', () => {
  const seattle = { lat: 47.6062, lng: -122.3321 };
  const portland = { lat: 45.5152, lng: -122.6784 };

  it('haversine is roughly right (Seattle–Portland ≈ 234 km)', () => {
    expect(haversineMeters(seattle, portland) / 1000).toBeCloseTo(234, -1);
  });

  it('estimates a straight-line leg with a road factor', () => {
    const leg = estimateLeg(seattle, portland);
    expect(leg.isEstimate).toBe(true);
    expect(leg.geometry.coordinates).toHaveLength(2);
    expect(leg.distanceM).toBeGreaterThan(haversineMeters(seattle, portland));
  });

  it('legKey is stable for the same endpoints', () => {
    expect(legKey(seattle, portland)).toBe(legKey({ ...seattle }, { ...portland }));
    expect(legKey(seattle, portland)).not.toBe(legKey(portland, seattle));
  });
});
