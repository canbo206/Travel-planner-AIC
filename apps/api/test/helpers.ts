import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { clearUserCache } from '../src/middleware/auth.js';

export const app = createApp();
export const api = supertest(app);

/** Wipes every table. Tests run against a dedicated test database. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "SavedTrip", "Photo", "Segment", "Stop", "Trip", "User" RESTART IDENTITY CASCADE',
  );
  clearUserCache();
}

/** Request helpers that sign in as a dev user. */
export function as(username: string) {
  const h = { 'x-dev-user': username };
  return {
    get: (url: string) => api.get(url).set(h),
    post: (url: string) => api.post(url).set(h),
    put: (url: string) => api.put(url).set(h),
    patch: (url: string) => api.patch(url).set(h),
    delete: (url: string) => api.delete(url).set(h),
  };
}

export { prisma };
