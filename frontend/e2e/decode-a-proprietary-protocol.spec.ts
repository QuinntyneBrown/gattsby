// Traces to: FR-028, FR-029, FR-030, FR-031, FR-049, FR-054, NFR-005, NFR-008, TOOL-013–019
// Given the unknown-services device, when the person confirms three activity levels,
// then each recording is labelled and uses the same characteristics.

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/gattsby-test';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';

test.use({
  bluetooth: {
    devices: [devices.unknown.id],
    chooser: [{ cancel: true }, { pick: devices.unknown.id }],
  },
});

async function connectToRower(page: Page) {
  await page.clock.install();
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Rower', 'Don’t know');
  await investigation.choose('Find the device');
  await investigation.choose('Show all nearby devices');
  return investigation;
}

async function captureLevels(
  page: Page,
  investigation: InvestigationPage,
  bluetooth: FakeBluetooth,
) {
  const levels = [
    'Keep the rower idle, then tap Ready',
    'Row at an easy pace, then tap Ready',
    'Row a little faster, then tap Ready',
  ];
  for (const [effort, title] of levels.entries()) {
    await investigation.waitForPrompt(title);
    const before = bluetooth.calls().filter((call) => call === 'startNotifications').length;
    await bluetooth.setEffort(effort);
    await investigation.choose('Ready');
    await expect
      .poll(() => bluetooth.calls().filter((call) => call === 'startNotifications').length)
      .toBeGreaterThan(before);
    await page.clock.runFor(10_300);
  }
}

test('records idle and two effort levels from the same device', async ({ page, fakeBluetooth }) => {
  const investigation = await connectToRower(page);
  const id = investigation.id();
  const records = new StoredRecords(page);
  await investigation.waitForPrompt('Keep the rower idle, then tap Ready');
  await page.clock.runFor(2_000);
  expect(fakeBluetooth.calls()).not.toContain('startNotifications');
  await captureLevels(page, investigation, fakeBluetooth);
  await expect
    .poll(() => records.recordings(id))
    .toMatchObject([
      { label: 'idle', level: 0, seconds: 10, interrupted: false },
      { label: 'slow', level: 1, seconds: 10, interrupted: false },
      { label: 'fast', level: 2, seconds: 10, interrupted: false },
    ]);
  const rows = await records.recordings(id);
  expect(rows.every((row) => row.valueCount >= 10)).toBe(true);
  expect(rows[1].characteristics).toEqual(rows[0].characteristics);
  expect(rows[2].characteristics).toEqual(rows[0].characteristics);
  expect(fakeBluetooth.writes()).toEqual([]);
});
