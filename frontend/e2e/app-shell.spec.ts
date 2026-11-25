// Requirements: NFR-004, NFR-012, NFR-026
// The app shell opens in Chromium from the production build, drawn from the design system in the
// person's theme, with self-hosted fonts.

import { expect, test } from './fixtures/gattsby-test';
import { HomePage } from './pages/home.page';
import { Theme } from './pages/theme';

const paper = 'rgb(243, 241, 234)';
const ink = 'rgb(21, 23, 27)';

test.describe('App shell', () => {
  // Journey 1's critical acceptance path, run in CI: the production build opens under its Content
  // Security Policy, with the fakes and every guard installed.
  test(
    'Given the production build, when the person opens /, then Gattsby opens with its app bar',
    { tag: '@critical' },
    async ({ page }) => {
      const home = new HomePage(page);

      await home.goto();

      expect(await home.title()).toBe('Gattsby');
      await expect(home.brand).toBeVisible();
      await expect(home.main).toBeAttached();
    },
  );

  test('Given the Home page, when the person presses Tab then Enter on "Skip to content", then focus moves to the main content', async ({
    page,
  }) => {
    const home = new HomePage(page);
    await home.goto();

    await page.keyboard.press('Tab');
    await expect(home.skipLink).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(home.main).toBeFocused();
    await expect(page).toHaveURL('/');
  });

  test('Given a light preference, when the person opens /, then the canvas is paper', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const home = new HomePage(page);

    await home.goto();

    expect(await new Theme(page).canvasColour()).toBe(paper);
  });

  test('Given a dark preference, when the person opens /, then the canvas is ink', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const home = new HomePage(page);

    await home.goto();

    expect(await new Theme(page).canvasColour()).toBe(ink);
  });

  test('Given the production build, when the person opens /, then Geist is loaded from the app itself', async ({
    page,
  }) => {
    const fontHosts = new Set<string>();
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontHosts.add(new URL(request.url()).host);
    });
    const home = new HomePage(page);

    await home.goto();

    expect(await new Theme(page).loadedFontFamilies()).toContain('Geist');
    expect([...fontHosts]).toEqual(['localhost:4300']);
  });
});
