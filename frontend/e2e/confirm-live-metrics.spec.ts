// Acceptance Test
// Traces to: FR-024, FR-025, FR-026, FR-027, FR-054, FR-057, FR-060, TOOL-013, TOOL-015, TOOL-026, TOOL-031
// Description: Show live standard data and confirm it only when it follows a physical action.

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

async function identifyMachine(page: Page, machine = 'Treadmill'): Promise<InvestigationPage> {
  await page.clock.install();
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare(machine, 'Don’t know');
  await investigation.choose('Find the device');

  await expect(investigation.stageState('Standard path')).toHaveText('Standard path: now');
  return investigation;
}

async function startRecording(
  page: Page,
  fakeBluetooth: FakeBluetooth,
  machine = 'Treadmill',
): Promise<InvestigationPage> {
  const investigation = await identifyMachine(page, machine);
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  return investigation;
}

test('Given an FTMS treadmill exposes the feature bits and a speed range, when Identify finishes, then the agent has read each value once and saved the supported range', async ({
  page,
}) => {
  const investigation = await identifyMachine(page);
  await expect(investigation.feedTool('read_supported_ranges')).toContainText(
    'Speed 0.8–16.0 km/h by 0.1',
  );

  const entries = await new StoredRecords(page).rawLog(investigation.id());
  for (const uuid of [uuids.fitnessMachineFeature, uuids.supportedSpeedRange]) {
    expect(entries.filter((entry) => entry.kind === 'read' && entry.uuid === uuid)).toHaveLength(1);
  }
});

test.describe('FTMS indoor bike', () => {
  test.use({ bluetooth: { devices: [devices.bike.id], chooser: [{ pick: devices.bike.id }] } });

  test('Given an FTMS bike, when the person pedals harder and speed rises, then the app shows live cadence and issues Connected — FTMS', async ({
    page,
    fakeBluetooth,
  }) => {
    const investigation = await startRecording(page, fakeBluetooth, 'Bike');
    await page.clock.runFor(1100);
    await expect(investigation.liveMetric('Cadence')).toContainText(/60(?:\.0)?\s*rpm/);
    await expect(investigation.liveMetric('Power')).toContainText(/75\s*W/);
    await page.clock.runFor(10_000);
    await investigation.waitForPrompt('Now pedal faster.');

    await fakeBluetooth.setEffort(2);
    await page.clock.runFor(1100);
    await expect(investigation.liveMetric('Cadence')).toContainText(/120(?:\.0)?\s*rpm/);
    await investigation.choose('Done');

    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Connected — FTMS');
    await expect(verdict.item('Can read', 'Speed')).toContainText('confirmed');
    expect(fakeBluetooth.writes()).toEqual([]);
  });
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
        kind: 'metric-confirmed',
        subject: 'speed',
        value: 'confirmed',
      }),
    );
  const speed = (await records.observations(id)).find((o) => o.subject === 'speed');
  expect(new Set(speed?.evidence.filter((id) => id.startsWith('r-'))).size).toBeGreaterThanOrEqual(
    2,
  );
});

test(
  'Given treadmill speed and distance both follow the walk, when the investigation concludes, then the verdict is Connected — FTMS and lists both metrics',
  {
    tag: '@critical',
  },
  async ({ page, fakeBluetooth, fakeModel }) => {
    const investigation = await startRecording(page, fakeBluetooth);
    const id = investigation.id();
    await page.clock.runFor(10_500);
    await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
    await fakeBluetooth.setEffort(2);
    await page.clock.runFor(2_100);
    await investigation.choose('Done');

    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Connected — FTMS');
    await expect(verdict.item('Can read', 'Speed')).toContainText('confirmed');
    await expect(verdict.item('Can read', 'Distance')).toContainText('confirmed');
    const records = new StoredRecords(page);
    expect((await records.investigation(id))?.verdict?.kind).toBe('connected');
    const observations = await records.observations(id);
    for (const metric of ['speed', 'distance']) {
      const observation = observations.find(
        (item) => item.kind === 'metric-confirmed' && item.subject === metric,
      );
      expect(
        new Set(observation?.evidence.filter((ref) => ref.startsWith('r-'))).size,
      ).toBeGreaterThanOrEqual(2);
    }
    expect(fakeModel.prompts()).toEqual([]);
    expect(fakeBluetooth.writes()).toEqual([]);
  },
);

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
