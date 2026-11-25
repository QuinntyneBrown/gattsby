// Traces to: FR-034, FR-035, FR-036, FR-037, FR-038, FR-039, FR-040, NFR-018, NFR-019, TOOL-021, TOOL-022, TOOL-024
// Given a confirmed FTMS treadmill, when the person skips the optional Control stage,
// then it reaches a verdict with the read evidence and sends no command.

import type { Page } from '@playwright/test';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

async function reachControl(page: Page, fakeBluetooth: FakeBluetooth) {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
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
  await investigation.waitForPrompt('Test control?');
  return investigation;
}

test('keeps control optional and records a read-only choice', async ({ page, fakeBluetooth }) => {
  const investigation = await reachControl(page, fakeBluetooth);
  await expect(investigation.subtitle).toHaveText('Agent · Control');
  expect(fakeBluetooth.writes()).toEqual([]);
  await investigation.choose('Skip — finish read-only');
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  expect(fakeBluetooth.writes()).toEqual([]);
  const records = new StoredRecords(page);
  expect(await records.observations(investigation.id())).toContainEqual(
    expect.objectContaining({ kind: 'answer', subject: 'Test control?', value: 'Skipped' }),
  );
});
