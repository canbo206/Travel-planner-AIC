import { PlaceSearchQuery } from '@roadtrip/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../lib/http.js';
import { searchPlaces } from '../services/geocoding.js';

export const geoRouter = Router();

// Typing in the search box fires many requests; keep the provider quota safe.
geoRouter.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));

geoRouter.get('/search', async (req, res) => {
  const { q, near } = PlaceSearchQuery.parse(req.query);
  const [lat, lng] = near ? near.split(',').map(Number) : [];
  try {
    const results = await searchPlaces(q, lat != null && lng != null ? { lat, lng } : undefined);
    res.json(results);
  } catch (err) {
    throw new HttpError(502, (err as Error).message);
  }
});
