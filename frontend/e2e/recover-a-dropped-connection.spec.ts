// Traces to: FR-016, FR-060, NFR-007, TOOL-007, TOOL-013
// Given a drop after six seconds of recording, when the second reconnect succeeds,
// then Gattsby resumes the interrupted step and keeps the earlier evidence and partial traffic.

import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';
import type { Page } from '@playwright/test';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

async function record(page: Page, fakeBluetooth: FakeBluetooth) {
  await page.clock.install();
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  return investigation;
}

test('reconnects to the same device and repeats the recording @critical', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await record(page, fakeBluetooth);
  const id = investigation.id();
  const stored = new StoredRecords(page);
  const earlier = await stored.steps(id);
  await page.clock.runFor(6_000);
  await fakeBluetooth.dropConnection(1);
  await expect(investigation.connectionBanner).toContainText('Connection dropped');
  expect(fakeBluetooth.calls().filter((name) => name === 'connect')).toHaveLength(1);
  await page.clock.runFor(1_100);
  await expect
    .poll(() => fakeBluetooth.calls().filter((name) => name === 'connect').length)
    .toBe(2);
  await expect(investigation.connectionBanner).toContainText('attempt 2 of 3');
  await page.clock.runFor(2_100);
  await expect(investigation.connectionBanner).toContainText('Reconnected after 2 tries');
  await expect
    .poll(() => stored.steps(id))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: 'subscribe_and_record', status: 'interrupted' }),
        expect.objectContaining({
          tool: 'reconnect',
          result: expect.objectContaining({
            data: expect.objectContaining({
              attempts: 2,
              restoredSubscriptions: [expect.any(String)],
            }),
          }),
        }),
      ]),
    );
  await expect
    .poll(() => fakeBluetooth.calls().filter((name) => name === 'startNotifications').length)
    .toBeGreaterThanOrEqual(2);
  await page.clock.runFor(10_200);
  await expect
    .poll(() => stored.recordings(id))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ interrupted: true, valueCount: expect.any(Number) }),
        expect.objectContaining({ interrupted: false, valueCount: expect.any(Number) }),
      ]),
    );
  expect((await stored.steps(id)).slice(0, earlier.length)).toEqual(earlier);
  expect(await stored.rawLog(id)).toContainEqual(expect.objectContaining({ kind: 'disconnect' }));
  expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(1);
  expect(fakeBluetooth.writes()).toEqual([]);
});

// Given three failed automatic attempts, when the person tries again and then stops,
// the same device is retried and the saved investigation receives exactly one verdict.
test('offers another cycle and can stop after reconnection fails', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await record(page, fakeBluetooth);
  const id = investigation.id();
  const stored = new StoredRecords(page);
  await page.clock.runFor(6_000);
  await fakeBluetooth.dropConnection(6);
  await expect(investigation.connectionBanner).toContainText('Connection dropped');
  await page.clock.runFor(7_200);
  await expect(investigation.connectionBanner).toContainText('Couldn’t reconnect after 3 tries.');
  expect(fakeBluetooth.calls().filter((name) => name === 'connect')).toHaveLength(4);
  await investigation.chooseRecovery('Try again');
  await expect(investigation.connectionBanner).toContainText('attempt 1 of 3');
  await page.clock.runFor(7_200);
  await expect(investigation.connectionBanner).toContainText('Everything so far is saved.');
  expect(fakeBluetooth.calls().filter((name) => name === 'connect')).toHaveLength(7);
  await investigation.chooseRecovery('Stop');
  await expect(new VerdictPage(page).title).toHaveText('Stopped by the person');
  expect((await stored.steps(id)).filter((step) => step.tool === 'finish')).toHaveLength(1);
  expect((await stored.recordings(id)).filter((recording) => recording.interrupted)).toHaveLength(
    1,
  );
  expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(1);
  expect(fakeBluetooth.writes()).toEqual([]);
});
