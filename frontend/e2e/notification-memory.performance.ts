// Traces to: NFR-005 AC1 (bounded investigation memory)
import { expect, test } from './fixtures/gattsby-test';
import { devices, uuids } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StillThereDialogPage } from './pages/still-there.dialog.page';

test.use({
  bluetooth: {
    devices: [devices.treadmill.id],
    chooser: [{ pick: devices.treadmill.id }],
    notificationPeriods: { [uuids.treadmillData]: 50 },
  },
});

test('a 30-minute investigation at 20 Hz persists packets without accumulating live heap', async ({
  page,
  context,
  fakeBluetooth,
}) => {
  test.setTimeout(15 * 60_000);
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  const idle = new StillThereDialogPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(10_100);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  const cdp = await context.newCDPSession(page);
  const heap: number[] = [];
  try {
    for (let minute = 1; minute <= 30; minute++) {
      await page.clock.runFor(60_150);
      if (await idle.dialog().isVisible()) await idle.continue();
      await cdp.send('HeapProfiler.collectGarbage');
      heap.push((await cdp.send('Runtime.getHeapUsage')).usedSize);
    }
  } finally {
    await cdp.detach();
  }
  const growth = Math.max(...heap.slice(4)) - heap[4];
  test.info().annotations.push({ type: 'peak heap growth (bytes)', description: String(growth) });
  console.log(`Peak used JS heap growth after minute 5: ${growth} bytes`);
  expect(growth).toBeLessThanOrEqual(20_000_000);
  const records = new StoredRecords(page);
  await expect.poll(() => records.rawCount(investigation.id())).toBeGreaterThanOrEqual(36_000);
});
