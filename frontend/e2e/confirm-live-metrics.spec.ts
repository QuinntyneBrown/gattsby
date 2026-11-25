// Acceptance Test
// Traces to: FR-024, FR-025, FR-026, FR-060, TOOL-013, TOOL-015, TOOL-026
// Description: Show live Treadmill Data and confirm it only when it follows a physical action.

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

async function startRecording(
  page: Page,
  fakeBluetooth: FakeBluetooth,
): Promise<InvestigationPage> {
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
  return investigation;
}

test('Given an identified FTMS treadmill, when the person starts walking, then notifications update the live speed without a model or write', async ({
  page,
  fakeBluetooth,
  fakeModel,
}) => {
  const investigation = await startRecording(page, fakeBluetooth);

  await page.clock.runFor(1100);
  await expect(investigation.liveMetric('Speed')).toContainText(/3\.0\s*km\/h/);

  await fakeBluetooth.setEffort(2);
  await page.clock.runFor(1100);
  await expect(investigation.liveMetric('Speed')).toContainText(/6\.0\s*km\/h/);
  expect(fakeBluetooth.writes()).toEqual([]);
  expect(fakeModel.prompts()).toEqual([]);
  expect(fakeModel.calls()).not.toContain('create');
});

test('Given a walking baseline, when the person speeds up during the prompt, then speed is confirmed with raw notification evidence', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await startRecording(page, fakeBluetooth);
  const id = investigation.id();
  await page.clock.runFor(10_500);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');

  await fakeBluetooth.setEffort(2);
  await page.clock.runFor(1100);
  await investigation.choose('Done');

  const records = new StoredRecords(page);
  await expect
    .poll(() => records.observations(id))
    .toContainEqual(
      expect.objectContaining({
        kind: 'metricConfirmation',
        subject: 'speed',
        value: 'confirmed',
      }),
    );
  const speed = (await records.observations(id)).find((o) => o.subject === 'speed');
  expect(new Set(speed?.evidence.filter((id) => id.startsWith('r-'))).size).toBeGreaterThanOrEqual(
    2,
  );
});

test('Given speed stays at the baseline, when 15 seconds pass after Done, then the person is asked what happened and the verdict remains Partially decoded', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await startRecording(page, fakeBluetooth);
  const id = investigation.id();
  await page.clock.runFor(10_500);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');

  await investigation.choose('Done');
  await page.clock.runFor(15_100);
  await investigation.waitForPrompt('Did the belt speed up?');
  await investigation.choose('Yes');

  await expect(new VerdictPage(page).title).toHaveText('Partially decoded');
  const observations = await new StoredRecords(page).observations(id);
  expect(observations).toContainEqual(
    expect.objectContaining({
      kind: 'metricConfirmation',
      subject: 'speed',
      value: 'notConfirmed',
    }),
  );
  expect(observations).toContainEqual(
    expect.objectContaining({ subject: 'Did the belt speed up?', value: 'Yes' }),
  );
});
