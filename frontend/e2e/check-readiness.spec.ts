// Traces to: FR-001, NFR-016, NFR-021, TOOL-001
// Given a supported browser with Bluetooth and the model, when Gattsby opens,
// then Readiness lists the capabilities and Start opens Home without requesting any permission.

import { expect, test } from './fixtures/gattsby-test';
import { HomePage } from './pages/home.page';
import { ReadinessPage } from './pages/readiness.page';

test('checks readiness at app launch and continues to Home @critical', async ({
  page,
  fakeBluetooth,
  fakeModel,
}) => {
  const readiness = new ReadinessPage(page);
  await readiness.openFromAppLaunch();
  await expect(page).toHaveURL('/start');
  await expect(readiness.heading).toHaveText('Ready to investigate.');
  for (const name of ['Browser', 'Bluetooth', 'On-device model', 'Camera', 'Storage']) {
    await expect(readiness.capability(name)).toContainText('Available');
  }
  await expect(readiness.capability('Advertisement scanning')).toContainText('Not available');
  await expect(readiness.capability('Advertisement scanning')).toContainText(
    'Only in Chrome with experimental features turned on',
  );
  expect(fakeBluetooth.requestDeviceOptions()).toEqual([]);
  expect(fakeModel.calls()).not.toContain('create');
  await readiness.start.click();
  await expect(new HomePage(page).identifyADevice).toBeVisible();
  await expect(page).toHaveURL('/');
});
