// Traces to: NFR-004, NFR-006, NFR-012, NFR-014
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  serviceWorkers: 'allow',
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
  model: { availability: 'absent', responses: [] },
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
  await home.goto();
  await home.identify();
  const investigation = new InvestigationPage(page);
  await investigation.prepare('Treadmill', 'Don’t know');
  for (const step of [
    'Find the device',
    'Connect to the device',
    'List exposed services',
    'Read device information',
    'Match known profiles',
    'Read supported ranges',
  ]) {
    await investigation.choose(step);
  }
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(10_500);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  await fakeBluetooth.setEffort(2);
  await page.clock.runFor(2_100);
  await investigation.choose('Done');
  await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
  await investigation.choose('Skip');
  await investigation.choose('Skip — finish read-only');
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  const cachedShell = await navigation;
  expect(cachedShell.ok()).toBe(true);
  expect(cachedShell.headers()['content-security-policy']).toContain(
    "require-trusted-types-for 'script'",
  );
  expect(fakeBluetooth.writes()).toEqual([]);
});
