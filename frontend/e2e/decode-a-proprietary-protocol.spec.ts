// Traces to: FR-028, FR-029, FR-030, FR-031, FR-049, FR-054, NFR-005, NFR-008, TOOL-013–019
// Given the unknown-services device, when the person confirms three activity levels,
// then each recording is labelled and uses the same characteristics.

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/gattsby-test';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { refuseNextRecordingCommit } from './fixtures/verdict-quota';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';

const dataUuid = 'ce060031-43e5-11e4-916c-0800200c9a66';
const silentUuid = 'ce060033-43e5-11e4-916c-0800200c9a66';

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

// Given the saved recordings, when the byte comparison runs, then the verdict links the
// offsets that follow effort to actual packets and identifies a silent characteristic.
test('reports a varying field with packet evidence @critical', async ({ page, fakeBluetooth }) => {
  const investigation = await connectToRower(page);
  const id = investigation.id();
  await captureLevels(page, investigation, fakeBluetooth);
  const verdict = new VerdictPage(page);
  await expect(verdict.title).toHaveText('Partially decoded');
  await expect(verdict.group('Observed')).toContainText('Varying bytes');
  const records = new StoredRecords(page);
  const steps = await records.steps(id);
  expect(steps.find(({ tool }) => tool === 'find_varying_bytes')?.result.data).toMatchObject({
    perCharacteristic: expect.arrayContaining([
      expect.objectContaining({ uuid: dataUuid, betweenLabels: expect.arrayContaining([5]) }),
    ]),
  });
  const observations = await records.observations(id);
  const varying = observations.find(
    ({ kind, subject }) => kind === 'varying-field' && subject === dataUuid,
  );
  const raw = await records.rawLog(id);
  const recordings = await records.recordings(id);
  for (const recording of recordings) {
    expect(varying?.evidence).toContain(recording.id);
    expect(
      raw.some(
        ({ id, recordingId }) => recordingId === recording.id && varying?.evidence.includes(id),
      ),
    ).toBe(true);
  }
  expect(observations).toContainEqual(
    expect.objectContaining({ kind: 'silent', subject: silentUuid }),
  );
  expect(fakeBluetooth.writes()).toEqual([]);
});

test.describe('The browser has no on-device model', () => {
  test.use({ model: { availability: 'absent' } });

  test('completes the proprietary recording and comparison in checklist mode', async ({
    page,
    fakeBluetooth,
    fakeModel,
  }) => {
    const investigation = await connectToRower(page);
    await investigation.choose('Connect to the device');
    await investigation.choose('List exposed services');
    await investigation.choose('Match known profiles');
    await captureLevels(page, investigation, fakeBluetooth);
    await expect(new VerdictPage(page).title).toHaveText('Partially decoded');
    expect(fakeModel.calls()).toEqual([]);
    expect(fakeBluetooth.writes()).toEqual([]);
  });
});

// Given three recordings with an effort-dependent field, the tool ranks the field and
// reports an encoding only if it fits the two active levels.
test('ranks the effort field and records a supported candidate encoding', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await connectToRower(page);
  const id = investigation.id();
  await captureLevels(page, investigation, fakeBluetooth);
  const verdict = new VerdictPage(page);
  await expect(verdict.title).toHaveText('Partially decoded');
  const records = new StoredRecords(page);
  const steps = await records.steps(id);
  const ranking = steps.find(({ tool }) => tool === 'correlate_with_action')?.result.data as
    { ranked: { correlation: number }[] } | undefined;
  expect(ranking?.ranked[0]).toMatchObject({
    uuid: dataUuid,
    offset: 5,
    width: 2,
    byteOrder: 'LE',
  });
  expect(ranking!.ranked[0].correlation).toBeGreaterThan(0.9);
  const encodings = steps.find(({ tool }) => tool === 'guess_field_encoding')?.result.data as
    { fits: { type: string; byteOrder: string; scale: number; unit: string }[] } | undefined;
  expect(encodings?.fits[0]).toMatchObject({
    type: 'uint16',
    byteOrder: 'LE',
    scale: 0.1,
    unit: 'spm',
  });
  await expect(verdict.group('Observed')).toContainText('Candidate encoding');
  expect(fakeBluetooth.writes()).toEqual([]);
});

// Given mixed packet lengths and a consistent checksum, the framing tool records
// the header, length byte, counter and checksum with the share that supports each.
test('records the packet framing and fit', async ({ page, fakeBluetooth }) => {
  const investigation = await connectToRower(page);
  const id = investigation.id();
  await captureLevels(page, investigation, fakeBluetooth);
  const verdict = new VerdictPage(page);
  await expect(verdict.title).toHaveText('Partially decoded');
  const records = new StoredRecords(page);
  const steps = await records.steps(id);
  expect(steps.find(({ tool }) => tool === 'detect_framing')?.result.data).toMatchObject({
    header: { bytes: 'F0', offset: 0, share: 1 },
    length: { offset: 2, includesHeader: true, share: 1 },
    counter: { offset: 1, step: 1, share: 1 },
    checksum: { offset: -1, algorithm: 'sum8', range: [0, -2], share: 1 },
    fit: 1,
  });
  await expect(verdict.group('Observed')).toContainText('Framing');
  expect(fakeBluetooth.writes()).toEqual([]);
});

// Given a saved baseline, when IndexedDB refuses a later recording, then the baseline
// remains readable and recording restarts only when the person chooses Record again.
test('keeps saved evidence and waits for an explicit recording retry when storage is full', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await connectToRower(page);
  const id = investigation.id();
  const records = new StoredRecords(page);
  await investigation.waitForPrompt('Keep the rower idle, then tap Ready');
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(10_300);
  await investigation.waitForPrompt('Row at an easy pace, then tap Ready');
  const calls = () => fakeBluetooth.calls().filter((call) => call === 'startNotifications').length;
  const first = calls();
  await refuseNextRecordingCommit(page);
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(calls).toBeGreaterThan(first);
  await page.clock.runFor(10_300);
  await investigation.waitForPrompt('Storage is full');
  const beforeRetry = calls();
  const saved = await records.recordings(id);
  expect(saved.map(({ label }) => label)).toEqual(['idle']);
  expect(
    (await records.rawLog(id))
      .filter(({ recordingId }) => recordingId)
      .every(({ recordingId }) => recordingId === saved[0].id),
  ).toBe(true);
  await page.clock.runFor(2_000);
  expect(calls()).toBe(beforeRetry);
  await investigation.choose('Record again');
  await expect.poll(calls).toBeGreaterThan(beforeRetry);
  await page.clock.runFor(10_300);
  await investigation.waitForPrompt('Row a little faster, then tap Ready');
  expect((await records.recordings(id)).map(({ label }) => label)).toEqual(['idle', 'slow']);
  expect(fakeBluetooth.writes()).toEqual([]);
});

test('stops listening before the recording window ends when a packet flush exhausts storage', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await connectToRower(page);
  await investigation.waitForPrompt('Keep the rower idle, then tap Ready');
  await refuseNextRecordingCommit(page, 'rawLog');
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(1_500);
  await investigation.waitForPrompt('Storage is full');
  expect(fakeBluetooth.calls()).toContain('stopNotifications');
  expect(await new StoredRecords(page).recordings(investigation.id())).toEqual([]);
});

// Given only one usable level, when the person tries a quick baseline and one
// activity, then the comparison names the characteristic and its changed offset.
test('offers a quick comparison after one usable level', async ({ page, fakeBluetooth }) => {
  const investigation = await connectToRower(page);
  const id = investigation.id();
  const starts = () => fakeBluetooth.calls().filter((call) => call === 'startNotifications').length;
  const readyAndRecord = async () => {
    const before = starts();
    await investigation.choose('Ready');
    await expect.poll(starts).toBeGreaterThan(before);
    await page.clock.runFor(10_300);
  };
  await investigation.waitForPrompt('Keep the rower idle, then tap Ready');
  await readyAndRecord();
  await investigation.waitForPrompt('Row at an easy pace, then tap Ready');
  await investigation.choose('Skip');
  await investigation.waitForPrompt('Row a little faster, then tap Ready');
  await investigation.choose('Skip');
  await investigation.waitForPrompt('Try one comparison?');
  await readyAndRecord();
  await investigation.waitForPrompt('Row at an easy pace, then tap Ready');
  // The other scripted active level wraps through zero in both byte positions.
  await fakeBluetooth.setEffort(2);
  await readyAndRecord();
  await expect(new VerdictPage(page).title).toHaveText('Partially decoded');
  const steps = await new StoredRecords(page).steps(id);
  const comparison = steps.find(({ tool }) => tool === 'baseline_vs_activity');
  expect(comparison?.result.data).toMatchObject({
    changed: expect.arrayContaining([{ uuid: dataUuid, offsets: expect.arrayContaining([5]) }]),
  });
  expect(fakeBluetooth.writes()).toEqual([]);
});
