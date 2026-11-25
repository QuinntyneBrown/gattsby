// Acceptance Test
// Traces to: FR-055
// Given an FTMS treadmill, when the investigation concludes, then its saved profile
// conforms to the published schema and each metric points to evidence in the record.

import type { Page } from '@playwright/test';
import Ajv from 'ajv';
import schema from '../src/schemas/device-profile-1.schema.json';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { DeviceProfilePage } from './pages/device-profile.page';
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
