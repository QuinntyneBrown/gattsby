import { defineConfig } from '@playwright/test';
import config from './playwright.config';

const url = 'http://localhost:4310';

// The 30-minute memory investigation uses Chromium's clock and is run explicitly.
export default defineConfig({
  ...config,
  testMatch: '**/notification-memory.performance.ts',
  workers: 1,
  outputDir: 'test-results/memory',
  use: { ...config.use, baseURL: url },
  webServer: { command: 'node scripts/serve-dist.ts --port 4310', url },
});
