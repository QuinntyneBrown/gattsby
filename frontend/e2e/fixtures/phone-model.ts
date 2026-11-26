import type { Page } from '@playwright/test';

const BASE = '/phone-model';
const WEIGHTS = BASE + '/assets/test-model.bin';
const BYTES = 256_000;

export async function usePhoneModel(
  page: Page,
  baseURL: string,
  options: {
    webGpu?: boolean;
    configured?: boolean;
    waitForFirstDownload?: Promise<void>;
    truncateFirst?: boolean;
  } = {},
) {
  let downloads = 0;
  let sessions = 0;
  const { webGpu = true, configured = true, waitForFirstDownload, truncateFirst } = options;
  await page.addInitScript((supported) => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: {
        mobile: true,
        platform: 'Android',
        brands: [{ brand: 'Chromium', version: '148' }],
      },
    });
    Object.defineProperty(navigator, 'gpu', {
      value: { requestAdapter: async () => (supported ? {} : null) },
    });
  }, webGpu);
  const url = (path: string) => new URL(path, baseURL).href;
  if (configured) {
    await page.context().route(url(BASE + '/manifest.json'), (route) =>
      route.fulfill({
        json: {
          id: 'test-model-v1',
          contextWindow: 16_384,
          files: [{ path: WEIGHTS, bytes: BYTES }],
        },
      }),
    );
  }
  await page.context().route(url(WEIGHTS), async (route) => {
    const attempt = ++downloads;
    if (attempt === 1) await waitForFirstDownload;
    await route.fulfill({ body: Buffer.alloc(attempt === 1 && truncateFirst ? 100 : BYTES) });
  });
  await page.context().route(url(BASE + '/worker.js'), (route) => {
    sessions++;
    return route.fulfill({
      contentType: 'text/javascript',
      body: `
        self.addEventListener('message', async ({ data }) => {
          const { id, type, cacheName, files } = data;
          if (type === 'abort') return;
          if (type === 'open') {
            const cache = await caches.open(cacheName);
            const weights = await cache.match(files[0].path);
            if (!weights) {
              self.postMessage({ id, error: 'Missing cached weights' });
              return;
            }
          }
          const value = type === 'ask' ? JSON.stringify({
            type: 'call_tool',
            tool: 'update_hypothesis',
            input: { protocol: 'FTMS', proposedConfidence: 1, evidence: ['s-7'] },
            why: 'The phone model found that Treadmill Data is a stronger fit.'
          }) : type === 'measure' ? 1024 : true;
          self.postMessage({ id, value });
        });
      `,
    });
  });
  return { downloads: () => downloads, sessions: () => sessions };
}
