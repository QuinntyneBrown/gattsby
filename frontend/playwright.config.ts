import { defineConfig, devices } from '@playwright/test';

// Behaviour specs only, on Chromium only (AGENTS.md "E2E"). They run against the production build
// served with its headers file, so the Content Security Policy and Trusted Types apply (ADR 0003).
// Build first: `npm run e2e` does both.
const port = 4300;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'off',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node scripts/serve-dist.ts --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env['CI'],
    stdout: 'ignore',
  },
});
