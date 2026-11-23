import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests share one database, so run files one at a time.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      AUTH_MODE: 'dev',
      ORS_API_KEY: '',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://roadtrip:roadtrip@localhost:5432/roadtrip_test',
    },
  },
});
