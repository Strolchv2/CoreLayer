import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-End-Tests. Erwartet eine laufende Instanz (Server liefert das gebaute Frontend aus):
 *   npm run build && SERVE_WEB=true npm start --workspace @cv-studio/server
 * Alternativ startet Playwright den Server selbst (webServer).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'de-DE',
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start:e2e --workspace @cv-studio/server',
        cwd: '../..',
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
});
