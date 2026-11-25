// Requirements: FR-064, NFR-004
// An address no route matches shows the Not found page (docs/mocks/pages/not-found/default.html).

import { expect, test } from './fixtures/gattsby-test';
import { HomePage } from './pages/home.page';
import { NotFoundPage } from './pages/not-found.page';

test.describe('Not found', () => {
  test('Given the app, when the person opens an unknown address, then the Not found page explains it', async ({
    page,
  }) => {
    const notFound = new NotFoundPage(page);

    await notFound.goto('/investigations/no-such-investigation');

    await expect(notFound.heading).toBeVisible();
    await expect(notFound.explanation).toBeVisible();
    await expect(notFound.goToHome).toBeVisible();
    expect(await notFound.title()).toBe('Not found · Gattsby');
  });

  test('Given the Not found page, when the person chooses "Go to home", then the Home page opens', async ({
    page,
  }) => {
    const notFound = new NotFoundPage(page);
    await notFound.goto('/anything-else');

    await notFound.goToHome.click();

    await expect(page).toHaveURL('/');
    expect(await new HomePage(page).title()).toBe('Gattsby');
  });

  test('Given the Not found page, when the person chooses the brand, then the Home page opens', async ({
    page,
  }) => {
    const notFound = new NotFoundPage(page);
    await notFound.goto('/anything-else');

    await notFound.brand.click();

    await expect(page).toHaveURL('/');
  });
});
