import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { geoRouter } from './routes/geo.js';
import { meRouter } from './routes/me.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // behind Render's proxy, so rate limits see real IPs
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/me', meRouter);
  app.use('/geo', geoRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
