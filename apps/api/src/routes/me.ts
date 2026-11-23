import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { listMyTrips, listSavedTrips } from '../services/trips.js';

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get('/', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  res.json(user);
});

meRouter.get('/trips', async (req, res) => {
  res.json(await listMyTrips(req.user!.id));
});

meRouter.get('/saved', async (req, res) => {
  res.json(await listSavedTrips(req.user!.id));
});
