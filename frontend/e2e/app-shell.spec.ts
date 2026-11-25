// Requirements: NFR-004, NFR-026
// The app shell opens in Chromium from the production build.

import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

test.describe('App shell', () => {
  test('Given the production build, when the person opens /, then Gattsby opens', async ({
    page,
  }) => {
    const home = new HomePage(page);

    await home.goto();

    expect(await home.title()).toBe('Gattsby');
  });
});
