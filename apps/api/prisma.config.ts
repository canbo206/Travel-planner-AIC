import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read loosely so `prisma generate` (run by npm install) works before .env exists.
    // Commands that touch the database still fail clearly if it's missing.
    url: process.env.DATABASE_URL ?? '',
  },
});
