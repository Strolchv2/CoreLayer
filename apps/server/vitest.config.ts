import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://cvstudio:cvstudio_dev@localhost:5432/cvstudio_test',
      STORAGE_DIR: path.join(os.tmpdir(), 'cvstudio-test-storage'),
      RATE_LIMIT_DISABLED: 'true',
      MAIL_TRANSPORT: 'outbox',
      APP_URL: 'http://localhost:5173',
      AI_PROVIDER: 'none',
    },
  },
});
