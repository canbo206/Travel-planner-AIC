import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  AUTH_MODE: z.enum(['dev', 'supabase']).default('dev'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_JWT_SECRET: z.string().default(''),

  ORS_API_KEY: z.string().default(''),

  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('trip-photos'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === 'production' && env.AUTH_MODE === 'dev') {
  console.error('AUTH_MODE=dev is not allowed in production. Set AUTH_MODE=supabase.');
  process.exit(1);
}
if (env.AUTH_MODE === 'supabase' && !env.SUPABASE_URL) {
  console.error('AUTH_MODE=supabase requires SUPABASE_URL.');
  process.exit(1);
}
