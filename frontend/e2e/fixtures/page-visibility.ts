import type { Page } from '@playwright/test';

export async function setPageVisibility(
  page: Page,
  visibility: 'hidden' | 'visible',
): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visibility);
}
