// Traces to: FR-064, NFR-013, NFR-015, NFR-024
import { readFile } from 'node:fs/promises';
import { finishTreadmill } from './fixtures/finish-treadmill';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { DeleteAllDataDialogPage } from './pages/delete-all-data.dialog.page';
import { DeviceProfilePage } from './pages/device-profile.page';
import { ExportDialogPage } from './pages/export.dialog.page';
import { HomePage } from './pages/home.page';
import { ImportDialogPage } from './pages/import.dialog.page';
import { SettingsPage } from './pages/settings.page';
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
