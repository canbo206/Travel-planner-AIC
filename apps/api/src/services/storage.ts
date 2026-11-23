/**
 * Photo uploads via Supabase Storage signed upload URLs.
 *
 * The browser asks the API for a signed URL, then uploads the file straight to
 * storage (the file never passes through our server), then tells the API the
 * public URL so we save a Photo row.
 */
import type { SignedUpload } from '@roadtrip/shared';
import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import { HttpError } from '../lib/http.js';

export function isStorageConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function createSignedUpload(
  userId: string,
  tripId: string,
  contentType: string,
): Promise<SignedUpload> {
  if (!isStorageConfigured()) {
    throw new HttpError(501, 'Photo uploads are not set up yet (Supabase Storage is not configured)');
  }
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const path = `${tripId}/${userId.replace(/[^a-zA-Z0-9-]/g, '')}/${randomUUID()}.${EXT[contentType] ?? 'jpg'}`;
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!res.ok) throw new HttpError(502, `Could not create upload URL (${res.status})`);
  const { url } = (await res.json()) as { url: string };
  return {
    uploadUrl: `${env.SUPABASE_URL}/storage/v1${url}`,
    publicUrl: `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`,
  };
}

/** Only accept photo URLs that point at our own bucket. */
export function isOwnStorageUrl(url: string) {
  if (!isStorageConfigured()) return true; // dev: allow any https image URL
  return url.startsWith(`${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/`);
}
