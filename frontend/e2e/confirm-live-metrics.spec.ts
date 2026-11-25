// Acceptance Test
// Traces to: FR-024, FR-026, TOOL-013, TOOL-015
// Description: Subscribe to Treadmill Data and show the decoded speed as notifications arrive.

import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

test('Given an identified FTMS treadmill, when the person starts walking, then notifications update the live speed without a model or write', async ({
  page,
  fakeBluetooth,
  fakeModel,
}) => {
  await page.clock.install();
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');

  await expect(investigation.stageState('Standard path')).toHaveText('Standard path: now');
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(1100);
  await expect(investigation.liveMetric('Speed')).toContainText(/3\.0\s*km\/h/);

  await fakeBluetooth.setEffort(2);
  await page.clock.runFor(1100);
  await expect(investigation.liveMetric('Speed')).toContainText(/6\.0\s*km\/h/);
  expect(fakeBluetooth.writes()).toEqual([]);
  expect(fakeModel.prompts()).toEqual([]);
  expect(fakeModel.calls()).not.toContain('create');
});
