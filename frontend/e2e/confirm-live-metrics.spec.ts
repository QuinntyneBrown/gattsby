// Acceptance Test
// Traces to: FR-024, FR-025, FR-026, FR-027, FR-060, TOOL-013, TOOL-015, TOOL-026, TOOL-031
// Description: Show live Treadmill Data and confirm it only when it follows a physical action.

import type { Page } from '@playwright/test';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { expect, test } from './fixtures/gattsby-test';
import { devices, uuids } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

async function identifyTreadmill(page: Page): Promise<InvestigationPage> {
  await page.clock.install();
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');

  await expect(investigation.stageState('Standard path')).toHaveText('Standard path: now');
  return investigation;
}

async function startRecording(
  page: Page,
  fakeBluetooth: FakeBluetooth,
): Promise<InvestigationPage> {
  const investigation = await identifyTreadmill(page);
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  return investigation;
}

test('Given an FTMS treadmill exposes the feature bits and a speed range, when Identify finishes, then the agent has read each value once and saved the supported range', async ({
  page,
}) => {
  const investigation = await identifyTreadmill(page);
  await expect(investigation.feedTool('read_supported_ranges')).toContainText(
    'Speed 0.8–16.0 km/h by 0.1',
  );

  const entries = await new StoredRecords(page).rawLog(investigation.id());
  for (const uuid of [uuids.fitnessMachineFeature, uuids.supportedSpeedRange]) {
    expect(entries.filter((entry) => entry.kind === 'read' && entry.uuid === uuid)).toHaveLength(1);
  }
});

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
