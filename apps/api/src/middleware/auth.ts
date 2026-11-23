/**
 * Authentication.
 *
 * AUTH_MODE=supabase  Verifies the Supabase access token sent as
 *                     `Authorization: Bearer <jwt>` (JWKS, or HS256 for
 *                     legacy projects with SUPABASE_JWT_SECRET).
 * AUTH_MODE=dev       Trusts an `x-dev-user: <username>` header. Local only:
 *                     env.ts refuses to start in production with this mode.
 *
 * Either way the user gets a row in our User table the first time we see them.
 */
import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../env.js';
import { prisma } from '../lib/db.js';
import { HttpError } from '../lib/http.js';

export interface AuthUser {
  id: string;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const jwks = env.SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;
const hsSecret = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : null;

/** Users we already upserted in this process, so we hit the DB once per user. */
const knownUsers = new Map<string, AuthUser>();

function slugUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  return cleaned.length >= 2 ? cleaned : `traveler${Math.floor(Math.random() * 10_000)}`;
}

async function ensureUser(id: string, preferredUsername: string, displayName?: string) {
  const cached = knownUsers.get(id);
  if (cached) return cached;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (existing) {
    const u = { id, username: existing.username };
    knownUsers.set(id, u);
    return u;
  }

  // Pick a free username: alex, alex2, alex3...
  const base = slugUsername(preferredUsername);
  let username = base;
  for (let n = 2; await prisma.user.findUnique({ where: { username } }); n++) {
    username = `${base}${n}`;
  }
  const created = await prisma.user.upsert({
    where: { id },
    update: {},
    create: { id, username, displayName: displayName ?? null },
  });
  const u = { id, username: created.username };
  knownUsers.set(id, u);
  return u;
}

async function verifySupabaseToken(token: string): Promise<JWTPayload> {
  if (hsSecret) {
    try {
      return (await jwtVerify(token, hsSecret)).payload;
    } catch {
      // Fall through to JWKS: the project may have rotated to asymmetric keys.
    }
  }
  if (!jwks) throw new HttpError(500, 'Auth is not configured');
  return (await jwtVerify(token, jwks, { issuer: `${env.SUPABASE_URL}/auth/v1` })).payload;
}

async function resolveUser(req: Parameters<RequestHandler>[0]): Promise<AuthUser | undefined> {
  if (env.AUTH_MODE === 'dev') {
    const name = req.header('x-dev-user')?.trim();
    if (!name) return undefined;
    return ensureUser(`dev:${slugUsername(name)}`, name, name);
  }

  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return undefined;
  let payload: JWTPayload;
  try {
    payload = await verifySupabaseToken(header.slice('Bearer '.length));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  if (!payload.sub) throw new HttpError(401, 'Invalid token');
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof payload.email === 'string' ? payload.email : '';
  const preferred =
    (typeof meta.username === 'string' && meta.username) || email.split('@')[0] || 'traveler';
  const displayName = typeof meta.full_name === 'string' ? meta.full_name : undefined;
  return ensureUser(payload.sub, preferred, displayName);
}

/** Attaches req.user when the request is signed in. Never rejects anonymous requests. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  req.user = await resolveUser(req);
  next();
};

/** Rejects the request with 401 unless it is signed in. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.user = req.user ?? (await resolveUser(req));
  if (!req.user) throw new HttpError(401, 'Sign in to do that');
  next();
};

/** For tests. */
export function clearUserCache() {
  knownUsers.clear();
}
