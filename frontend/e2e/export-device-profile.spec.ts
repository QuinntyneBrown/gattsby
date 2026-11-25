// Acceptance Test
// Traces to: FR-055, FR-062, FR-063, NFR-012, NFR-013, NFR-024
// Given an FTMS treadmill, when the investigation concludes, then its saved profile
// conforms to the published schema and each metric points to evidence in the record.

import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import schema from '../src/schemas/device-profile-1.schema.json';
import recordSchema from '../src/schemas/investigation-record-1.schema.json';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { seedStoredPhoto, tinyPng } from './fixtures/stored-photo';
import { StoredRecords } from './fixtures/stored-records';
import { DeviceProfilePage } from './pages/device-profile.page';
import { ExportDialogPage } from './pages/export.dialog.page';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

// Given a saved verdict, when the person opens its profile, then the recorded
// decoding rules and statuses are visible and the page works after reload.
test('opens the saved device profile and explains an unreadable profile', async ({
  page,
  fakeBluetooth,
}) => {
  await finishTreadmill(page, fakeBluetooth);
  const profile = new DeviceProfilePage(page);
  await new VerdictPage(page).deviceProfile.click({ timeout: 3_000 });
  await expect(profile.verdict).toBeVisible();
  await expect(profile.readableData).toContainText('0x2ACD');
  await expect(profile.readableData).toContainText('bytes 2–3');
  await page.reload();
  await expect(profile.readableData).toContainText('confirmed');
  await profile.open('p-missing');
  await expect(profile.error).toContainText('This profile couldn’t be opened');
});

async function finishTreadmill(page: Page, bluetooth: FakeBluetooth): Promise<string> {
  await page.clock.install();
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await bluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => bluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(11_000);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  await bluetooth.setEffort(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
  await bluetooth.setIncline(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  return investigation.id();
}

// Given a completed investigation, when the person chooses Device profile in Export,
// then Chrome saves a schema-valid profile. The two entry points offer the same local export.
test('downloads a versioned profile from the verdict and device profile @critical', async ({
  page,
  fakeBluetooth,
}) => {
  const id = await finishTreadmill(page, fakeBluetooth);
  const verdict = new VerdictPage(page);
  const profile = new DeviceProfilePage(page);
  const dialog = new ExportDialogPage(page);
  const validate = new Ajv().compile(schema);
  const downloads: string[] = [];
  page.on('download', (file) => downloads.push(file.suggestedFilename()));

  for (const trigger of [verdict.exportProfile, profile.exportButton]) {
    const before = downloads.length;
    await trigger.click({ timeout: 3_000 });
    await expect(dialog.includeNotesAndPhotos).not.toBeChecked();
    expect(downloads).toHaveLength(before);
    const download = page.waitForEvent('download');
    await dialog.deviceProfile.click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
      /^hzn-t202-4f1a-\d{4}-\d{2}-\d{2}-profile\.gattsby\.json$/,
    );
    const exported: unknown = JSON.parse(await readFile((await file.path())!, 'utf8'));
    expect(validate(exported), JSON.stringify(validate.errors)).toBe(true);
    expect(exported).toMatchObject({ investigationId: id, formatVersion: '1.0' });
    expect(exported).not.toHaveProperty('rawLog');
    await expect(dialog.success).toContainText(file.suggestedFilename());
    await dialog.done.click();
    if (before === 0) await verdict.deviceProfile.click();
  }
  expect(downloads).toHaveLength(2);
});

test('saves one versioned device profile with evidence for each reading', async ({
  page,
  fakeBluetooth,
}) => {
  const id = await finishTreadmill(page, fakeBluetooth);
  const records = new StoredRecords(page);
  const profiles = await records.profiles();
  expect(profiles).toHaveLength(1);
  const [profile] = profiles;
  const validate = new Ajv().compile(schema);
  expect(validate(profile), JSON.stringify(validate.errors)).toBe(true);
  expect(profile).toMatchObject({
    investigationId: id,
    formatVersion: '1.0',
    verdict: { kind: 'connected', protocol: 'FTMS' },
    metrics: expect.arrayContaining([
      expect.objectContaining({ metric: 'speed', status: 'confirmed' }),
    ]),
    features: expect.arrayContaining([
      expect.objectContaining({
        feature: 'setTargetSpeed',
        status: 'claimedOnly',
        range: expect.objectContaining({ min: 0.8, max: 16, increment: 0.1 }),
      }),
    ]),
  });
  const rows = [
    ...(await records.rawLog(id)),
    ...(await records.observations(id)),
    ...(await records.steps(id)),
  ] as { id: string }[];
  const evidenceIds = new Set(rows.map((row) => row.id));
  const saved = profile as {
    metrics: { evidence: string[] }[];
    features: { evidence: string[] }[];
  };
  for (const item of [...saved.metrics, ...saved.features]) {
    expect(item.evidence.length).toBeGreaterThan(0);
    for (const evidence of item.evidence) expect(evidenceIds.has(evidence), evidence).toBe(true);
  }
});

// Given a completed investigation, when the person exports the record, then
// it contains every recorded packet and answer. Private attachments are opt-in.
test('exports the whole record with attachments excluded by default', async ({
  page,
  fakeBluetooth,
}) => {
  const id = await finishTreadmill(page, fakeBluetooth);
  const records = new StoredRecords(page);
  const verdict = new VerdictPage(page);
  const dialog = new ExportDialogPage(page);
  const validate = new Ajv({ strictRequired: false }).addSchema(schema).compile(recordSchema);
  await seedStoredPhoto(page, id);

  await verdict.exportRecord.click({ timeout: 3_000 });
  await expect(dialog.includeNotesAndPhotos).not.toBeChecked();
  const download = page.waitForEvent('download');
  await dialog.fullRecord.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-record\.gattsby\.json$/);
  const exported: unknown = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(validate(exported), JSON.stringify(validate.errors)).toBe(true);
  expect(exported).toMatchObject({
    investigation: { id },
    profile: { investigationId: id },
    rawLog: expect.arrayContaining([
      expect.objectContaining({
        kind: 'notification',
        hex: expect.any(String),
        t: expect.any(Number),
      }),
    ]),
    steps: expect.arrayContaining([
      expect.objectContaining({ exchange: expect.objectContaining({ answer: 'Ready' }) }),
    ]),
    includesNotesAndPhotos: false,
    omitted: { photos: 1 },
  });
  expect(exported).not.toHaveProperty('photos');
  expect((exported as { rawLog: unknown[] }).rawLog).toHaveLength(await records.rawCount(id));
  await dialog.done.click();

  await verdict.exportRecord.click();
  await dialog.includeNotesAndPhotos.check();
  const optedIn = page.waitForEvent('download');
  await dialog.fullRecord.click();
  const withPhotos: unknown = JSON.parse(await readFile((await (await optedIn).path())!, 'utf8'));
  expect(validate(withPhotos), JSON.stringify(validate.errors)).toBe(true);
  expect(withPhotos).toMatchObject({
    includesNotesAndPhotos: true,
    photos: [{ id: 'ph-fixture', mediaType: 'image/png', dataBase64: tinyPng }],
  });
  expect(withPhotos).not.toHaveProperty('omitted');
});
