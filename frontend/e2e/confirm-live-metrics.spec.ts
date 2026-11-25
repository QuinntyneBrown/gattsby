// Acceptance Test
// Traces to: FR-024, FR-025, FR-026, FR-027, FR-051, FR-054, FR-057, FR-060, NFR-001, TOOL-013, TOOL-015, TOOL-026, TOOL-031
// Description: Show live standard data and confirm it only when it follows a physical action.

import type { Page } from '@playwright/test';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { expect, test } from './fixtures/gattsby-test';
import { devices, uuids } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StillThereDialogPage } from './pages/still-there.dialog.page';
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

  test('Given an FTMS bike, when pedalling faster raises speed, cadence and power, then the Connected — FTMS verdict confirms each reading', async ({
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
    await investigation.choose('Skip — finish read-only');

    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Connected — FTMS');
    expect(await page.evaluate(() => performance.now())).toBeLessThan(180_000);
    await expect(verdict.item('Can read', 'Speed')).toContainText('confirmed');
    await expect(verdict.item('Can read', 'Cadence')).toContainText('120.0 rpm');
    await expect(verdict.item('Can read', 'Power')).toContainText('150 W');
    expect(fakeBluetooth.writes()).toEqual([]);
  });
});

test('Given the treadmill confirms speed, when the person raises incline on the console, then its live rise confirms it and retains the earlier evidence', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await startRecording(page, fakeBluetooth);
  await page.clock.runFor(11_000);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  await fakeBluetooth.setEffort(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
  await fakeBluetooth.setIncline(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await investigation.choose('Skip — finish read-only');
  const verdict = new VerdictPage(page);
  await expect(verdict.item('Can read', 'Speed')).toContainText('confirmed');
  await expect(verdict.item('Can read', 'Incline')).toContainText('2.0 %');
  await expect(verdict.item('Can read', 'Elapsed')).toContainText('confirmed');
  expect(fakeBluetooth.writes()).toEqual([]);
});

test.describe('Heart-rate strap', () => {
  test.use({
    bluetooth: { devices: [devices.strap.id], chooser: [{ pick: devices.strap.id }] },
    viewport: { width: 390, height: 844 },
  });

  test('Given a heart-rate strap is subscribed, when BPM rises during light activity, then live BPM updates and the verdict is Connected — Heart Rate', async ({
    page,
    fakeBluetooth,
    fakeModel,
  }) => {
    const investigation = await startRecording(page, fakeBluetooth, 'Heart-rate sensor');
    await page.clock.runFor(1100);
    const bpm = investigation.liveMetric('Heart rate');
    await expect(bpm).toContainText(/95\s*BPM/);
    expect((await bpm.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await page.clock.runFor(10_000);
    await investigation.waitForPrompt('Walk briefly at an easy pace.');

    await fakeBluetooth.setEffort(2);
    await page.clock.runFor(1100);
    await expect(bpm).toContainText(/120\s*BPM/);
    await investigation.choose('Done');

    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Connected — Heart Rate');
    await expect(verdict.item('Can read', 'Heart rate')).toContainText('120 BPM');
    expect(fakeBluetooth.writes()).toEqual([]);
    expect(fakeModel.prompts()).toEqual([]);
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
  await expect(investigation.liveMetric('Speed')).toContainText('likely');
  await expect(investigation.liveRate).toHaveText('1 Hz');
  expect(fakeBluetooth.writes()).toEqual([]);
  expect(fakeModel.prompts()).toEqual([]);
  expect(fakeModel.calls().filter((method) => method === 'create')).toHaveLength(1);
});

test('Given a timed recording, when the baseline finishes, then each Treadmill Data notification is stored with its decoded fields and raw bytes', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await startRecording(page, fakeBluetooth);
  await page.clock.runFor(10_500);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  const records = new StoredRecords(page);
  const [recording] = await records.recordings(investigation.id());
  expect(recording).toMatchObject({
    label: 'Baseline',
    characteristics: [uuids.treadmillData],
    seconds: 10,
    interrupted: false,
  });
  const rows = await records.rawLog(investigation.id());
  const packets = rows.filter(
    (row) => row.kind === 'notification' && row.uuid === uuids.treadmillData,
  );
  expect(packets.length).toBeGreaterThanOrEqual(10);
  expect(packets.filter((packet) => packet.recordingId === recording.id)).toHaveLength(
    recording.valueCount,
  );
  expect(recording.valueCount).toBeGreaterThanOrEqual(10);
  for (const packet of packets) {
    expect(packet.hex).toMatch(/^0C 04 2C 01 /);
    expect(packet.decoded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'speed', value: 3, unit: 'km/h', offset: 2 }),
        expect.objectContaining({ metric: 'distance', unit: 'm', flag: 2 }),
        expect.objectContaining({ metric: 'elapsed', unit: 's', flag: 10 }),
      ]),
    );
  }
});

test('Given Ready has not been tapped for two minutes, when the person continues and later stops from Still there, then the original prompt returns and no recording starts', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await identifyMachine(page);
  const dialog = new StillThereDialogPage(page);
  await expect(investigation.answer('Ready')).toBeVisible();
  await page.clock.runFor(120_100);
  await expect(dialog.dialog()).toBeVisible();
  await dialog.continue();
  await expect(investigation.answer('Ready')).toBeVisible();
  expect(fakeBluetooth.calls()).not.toContain('startNotifications');

  await page.clock.runFor(120_100);
  await dialog.stop();
  await expect(new VerdictPage(page).title).toHaveText('Stopped by the person');
  expect(fakeBluetooth.calls()).not.toContain('startNotifications');
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
    await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
    await investigation.choose('Skip');
    await investigation.choose('Skip — finish read-only');

    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Connected — FTMS');
    await expect(verdict.item('Can read', 'Speed')).toContainText('confirmed');
    await expect(verdict.item('Can read', 'Distance')).toContainText('confirmed');
    expect(await page.evaluate(() => performance.now())).toBeLessThan(180_000);
    const records = new StoredRecords(page);
    expect((await records.investigation(id))?.verdict?.kind).toBe('connected');
    const [baseline] = await records.recordings(id);
    const analysis = (await records.steps(id)).find((step) => step.tool === 'decode_standard');
    expect(analysis?.result).toMatchObject({
      ok: true,
      data: {
        recordingId: baseline.id,
        statistics: expect.arrayContaining([
          { metric: 'speed', min: 3, max: 3, trend: 'flat' },
          expect.objectContaining({ metric: 'distance', trend: 'rising' }),
        ]),
        readableMetrics: expect.arrayContaining([
          expect.objectContaining({
            metric: 'speed',
            characteristic: uuids.treadmillData,
            status: 'confirmed',
            rule: { kind: 'offset', from: 2, to: 3 },
            type: 'uint16',
            scale: 0.01,
            unit: 'km/h',
            evidence: expect.arrayContaining([expect.stringMatching(/^r-/)]),
          }),
          expect.objectContaining({
            metric: 'distance',
            status: 'confirmed',
            rule: { kind: 'flag', bit: 2 },
            unit: 'm',
          }),
          expect.objectContaining({ metric: 'incline', status: 'claimedOnly' }),
          expect.objectContaining({
            metric: 'heartRate',
            status: 'claimedNotSeen',
            rule: { kind: 'flag', bit: 8 },
          }),
        ]),
      },
    });
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
  await expect(investigation.promptEyebrow).toHaveText('Speed not confirmed');
  await expect(investigation.promptDetail).toContainText(
    'The data didn’t show the expected change',
  );
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
