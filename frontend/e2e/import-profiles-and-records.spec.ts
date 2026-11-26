// Traces to: FR-064, NFR-013, NFR-015, NFR-024
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { finishTreadmill } from './fixtures/finish-treadmill';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { seedStoredPhoto } from './fixtures/stored-photo';
import { StoredRecords } from './fixtures/stored-records';
import { DeleteAllDataDialogPage } from './pages/delete-all-data.dialog.page';
import { DeviceProfilePage } from './pages/device-profile.page';
import { ExportDialogPage } from './pages/export.dialog.page';
import { HomePage } from './pages/home.page';
import { HistoryPage } from './pages/history.page';
import { ImportDialogPage } from './pages/import.dialog.page';
import { SettingsPage } from './pages/settings.page';
import { SavedDevicesPage } from './pages/saved-devices.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

// Given a locally exported profile, when it is imported after clearing test
// storage, then the profile reopens with all the exported fields intact.
test('re-imports the exported profile without changing its fields @critical', async ({
  page,
  fakeBluetooth,
}) => {
  await finishTreadmill(page, fakeBluetooth);
  await new VerdictPage(page).exportProfile.click();
  const exportDialog = new ExportDialogPage(page);
  const saving = page.waitForEvent('download');
  await exportDialog.deviceProfile.click();
  const file = await saving;
  const content = await readFile((await file.path())!);
  const original = JSON.parse(content.toString('utf8'));
  await exportDialog.done.click();

  const settings = await openEmptySettings(page);
  await settings.importFile.click({ timeout: 4_000 });
  const dialog = new ImportDialogPage(page);
  await dialog.picker.setInputFiles({
    name: file.suggestedFilename(),
    mimeType: 'application/json',
    buffer: content,
  });
  await expect(dialog.message).toContainText('Imported');
  await dialog.openProfile.click();
  await expect(new DeviceProfilePage(page).verdict).toBeVisible();
  expect(await new StoredRecords(page).profiles()).toEqual([original]);
  expect(fakeBluetooth.writes()).toEqual([]);
});

// Given an investigation exported with its photo, importing a supported 1.0 file
// restores the verdict, timestamped traffic and the attachment without resuming it.
test('opens the verdict and restores evidence from an older full record', async ({
  page,
  fakeBluetooth,
}) => {
  const id = await finishTreadmill(page, fakeBluetooth);
  await seedStoredPhoto(page, id);
  const records = new StoredRecords(page);
  const originalPackets = await records.rawLog(id);
  await new VerdictPage(page).exportRecord.click();
  const exportDialog = new ExportDialogPage(page);
  await exportDialog.includeNotesAndPhotos.check();
  const saving = page.waitForEvent('download');
  await exportDialog.fullRecord.click();
  const file = await saving;
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  await exportDialog.done.click();
  exported.formatVersion = '1.0';

  const settings = await openEmptySettings(page);
  await settings.importFile.click();
  const dialog = new ImportDialogPage(page);
  const upload = {
    name: file.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  };
  await dialog.picker.setInputFiles(upload);
  await expect(dialog.message).toContainText('Imported');
  await dialog.openInvestigation.click();
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  expect(await records.rawLog(id)).toEqual(originalPackets);
  expect(await records.photoCount(id)).toBe(1);
  await page.goto(`/investigations/${id}?resume=true`);
  await expect(page).toHaveURL(`/investigations/${id}/verdict`);

  const home = new HomePage(page);
  await home.goto();
  await home.pastInvestigations.click();
  const history = new HistoryPage(page);
  await expect(history.investigationLinks).toHaveCount(1);
  await expect(history.investigationLinks.first()).toHaveAttribute(
    'href',
    `/investigations/${id}/verdict`,
  );
  await home.goto();
  await home.settings.click();
  await settings.importFile.click();
  await dialog.picker.setInputFiles(upload);
  await expect(dialog.message).toContainText('already on this device');
  expect(fakeBluetooth.writes()).toEqual([]);
});

async function openEmptySettings(page: Page): Promise<SettingsPage> {
  const home = new HomePage(page);
  const settings = new SettingsPage(page);
  await home.goto();
  await home.settings.click();
  await settings.deleteAll.click();
  const confirmation = new DeleteAllDataDialogPage(page);
  await confirmation.confirmation.fill('DELETE');
  await confirmation.confirm.click();
  await expect(home.dataDeleted).toBeVisible();
  await home.settings.click();
  return settings;
}

// Given unsupported or broken files, the import dialog provides the refusal
// reason and does not put a profile or investigation into IndexedDB.
test('refuses malformed, unknown-version and disallowed files', async ({ page }) => {
  const saved = new SavedDevicesPage(page);
  await saved.goto();
  await saved.importFile.click({ timeout: 4_000 });
  const dialog = new ImportDialogPage(page);
  const examples = [
    ['not json', 'doesn’t contain valid JSON'],
    ['{"kind":"gattsby.device-profile"}', 'no recognised type and format version'],
    ['{"kind":"gattsby.device-profile","formatVersion":"3.0"}', 'Made by a newer Gattsby'],
    [
      '{"kind":"gattsby.device-profile","formatVersion":"1.0"}',
      'doesn’t match the device profile format',
    ],
    ['{"__proto__":{}}', 'disallowed object key'],
  ];
  for (const [body, reason] of examples) {
    await dialog.picker.setInputFiles({
      name: 'test.gattsby.json',
      mimeType: 'application/json',
      buffer: Buffer.from(body),
    });
    await expect(dialog.message).toContainText(reason);
    await expect(dialog.message).toContainText('Nothing was imported');
  }
  const records = new StoredRecords(page);
  expect(await records.profiles()).toEqual([]);
  expect(await records.investigations()).toEqual([]);
});

test('renders imported names as text and keeps notes opt-in on re-export', async ({
  page,
  fakeBluetooth,
}) => {
  await finishTreadmill(page, fakeBluetooth);
  await new VerdictPage(page).exportProfile.click();
  const exporting = new ExportDialogPage(page);
  const file = page.waitForEvent('download');
  await exporting.deviceProfile.click();
  const download = await file;
  const profile = JSON.parse(await readFile((await download.path())!, 'utf8'));
  await exporting.done.click();
  profile.id = 'p-text-fixture';
  profile.investigationId = 'i-text-fixture';
  profile.identity.displayName = '<script></script>';
  profile.notes = ['Private test note'];

  const saved = new SavedDevicesPage(page);
  await saved.goto();
  await saved.importFile.click();
  const importing = new ImportDialogPage(page);
  await importing.picker.setInputFiles({
    name: 'text-profile.gattsby.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(profile)),
  });
  await importing.openProfile.click();
  const profilePage = new DeviceProfilePage(page);
  await expect(profilePage.name).toHaveText('<script></script>');
  await expect(profilePage.notes).toContainText('Private test note');
  await profilePage.exportButton.click();
  await expect(exporting.includeNotesAndPhotos).not.toBeChecked();
  const fileAgain = page.waitForEvent('download');
  await exporting.deviceProfile.click();
  const savedAgain = await fileAgain;
  expect(JSON.parse(await readFile((await savedAgain.path())!, 'utf8'))).not.toHaveProperty(
    'notes',
  );
});
