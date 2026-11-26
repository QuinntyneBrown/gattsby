// Traces to: NFR-004, NFR-006, NFR-012, NFR-014
import { finishTreadmill } from './fixtures/finish-treadmill';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { HomePage } from './pages/home.page';

test.use({
  serviceWorkers: 'allow',
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

// Given an online first visit, when the browser goes offline and opens the app again,
// then the cached shell and lazy chunks run the whole investigation to an FTMS verdict.
test('runs a full investigation offline after one online load @critical', async ({
  page,
  context,
  fakeBluetooth,
}) => {
  const home = new HomePage(page);
  await home.goto();
  await expect
    .poll(
      () =>
        page.evaluate(
          async () =>
            !!navigator.serviceWorker.controller &&
            (await fetch('/index.html')).ok &&
            !!(await caches.match('/index.html')),
        ),
      { timeout: 8_000 },
    )
    .toBe(true);
  await context.setOffline(true);
  const navigation = page.waitForResponse(
    (response) => response.request().isNavigationRequest() && response.fromServiceWorker(),
  );
  await finishTreadmill(page, fakeBluetooth);
  const cachedShell = await navigation;
  expect(cachedShell.ok()).toBe(true);
  expect(cachedShell.headers()['content-security-policy']).toContain(
    "require-trusted-types-for 'script'",
  );
  expect(fakeBluetooth.writes()).toEqual([]);
});
