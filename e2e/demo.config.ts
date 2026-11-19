import { defineConfig } from '@playwright/test';

// Recorded live walkthrough of the running app (synthetic demo data). Not part of the test gate.
export default defineConfig({
  testDir: './demo',
  timeout: 600_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    launchOptions: { slowMo: 120 }
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev:all', cwd: '..', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 120_000
  }
});
