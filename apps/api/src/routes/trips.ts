import {
  AddPhotoInput,
  CreateTripInput,
  DiscoverQuery,
  PutStopsInput,
  RecreateTripInput,
  SignUploadInput,
  UpdateTripInput,
} from '@roadtrip/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { badRequest } from '../lib/http.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { createSignedUpload, isOwnStorageUrl } from '../services/storage.js';
import * as trips from '../services/trips.js';

export const tripsRouter = Router();

/** Stop edits can trigger routing API calls; cap them per IP. */
const routingLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

// Discover: public trips with search, filters and sorting.
tripsRouter.get('/', async (req, res) => {
  res.json(await trips.discoverTrips(DiscoverQuery.parse(req.query)));
});

tripsRouter.post('/', requireAuth, async (req, res) => {
  res.status(201).json(await trips.createTrip(req.user!.id, CreateTripInput.parse(req.body)));
});

tripsRouter.get('/:id', optionalAuth, async (req, res) => {
  res.json(await trips.getTrip(req.params.id as string, req.user?.id));
});

tripsRouter.patch('/:id', requireAuth, async (req, res) => {
  res.json(await trips.updateTrip(req.params.id as string, req.user!.id, UpdateTripInput.parse(req.body)));
});

tripsRouter.delete('/:id', requireAuth, async (req, res) => {
  await trips.deleteTrip(req.params.id as string, req.user!.id);
  res.status(204).end();
});

tripsRouter.put('/:id/stops', requireAuth, routingLimit, async (req, res) => {
  res.json(await trips.putStops(req.params.id as string, req.user!.id, PutStopsInput.parse(req.body)));
});

tripsRouter.post('/:id/recreate', requireAuth, async (req, res) => {
  const copy = await trips.recreateTrip(
    req.params.id as string,
    req.user!.id,
    RecreateTripInput.parse(req.body ?? {}),
  );
  res.status(201).json(copy);
});

tripsRouter.post('/:id/save', requireAuth, async (req, res) => {
  await trips.saveTrip(req.params.id as string, req.user!.id);
  res.status(204).end();
});

tripsRouter.delete('/:id/save', requireAuth, async (req, res) => {
  await trips.unsaveTrip(req.params.id as string, req.user!.id);
  res.status(204).end();
});

// Photos: the browser uploads to storage with a signed URL, then records it here.
tripsRouter.post('/:id/stops/:stopId/photos', requireAuth, async (req, res) => {
  const body = AddPhotoInput.parse(req.body);
  if (!isOwnStorageUrl(body.url)) throw badRequest('Photos must be uploaded to this app first');
  res
    .status(201)
    .json(await trips.addPhoto(req.params.id as string, req.params.stopId as string, req.user!.id, body));
});

tripsRouter.delete('/:id/photos/:photoId', requireAuth, async (req, res) => {
  res.json(await trips.deletePhoto(req.params.id as string, req.params.photoId as string, req.user!.id));
});

export const uploadsRouter = Router();

uploadsRouter.post('/sign', requireAuth, async (req, res) => {
  const { tripId, contentType } = SignUploadInput.parse(req.body);
  res.json(await createSignedUpload(req.user!.id, tripId, contentType));
});
