// Traces to: FR-009, FR-010, FR-061, FR-065, NFR-008
import { finishTreadmill } from './fixtures/finish-treadmill';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { seedMissingTools } from './fixtures/seed-missing-tools';
import { seedStoredPhoto } from './fixtures/stored-photo';
import { StoredRecords } from './fixtures/stored-records';
import { DeleteAllDataDialogPage } from './pages/delete-all-data.dialog.page';
import { DeleteInvestigationDialogPage } from './pages/delete-investigation.dialog.page';
import { DeviceProfilePage } from './pages/device-profile.page';
import { HistoryPage } from './pages/history.page';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StopInvestigationDialogPage } from './pages/stop-investigation.dialog.page';
import { SavedDevicesPage } from './pages/saved-devices.page';
import { SettingsPage } from './pages/settings.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

// Given a saved FTMS profile, when the person searches saved devices, matching
// profiles open locally and an unmatched query offers Clear search.
test('filters saved devices by name, protocol and device type', async ({ page, fakeBluetooth }) => {
  await finishTreadmill(page, fakeBluetooth);
  const home = new HomePage(page);
  await home.goto();
  await home.savedDevices.click({ timeout: 4_000 });
  const saved = new SavedDevicesPage(page);
  await expect(saved.title).toBeVisible();
  await expect(saved.profile(devices.treadmill.name)).toBeVisible();
  await saved.search.fill('unknown-model');
  await expect(saved.noResults).toBeVisible();
  await expect(saved.profile(devices.treadmill.name)).toHaveCount(0);
  await saved.clearSearch.click();
  await saved.filter('Spin bike').click();
  await expect(saved.noResults).toBeVisible();
  await saved.filter('Treadmill').click();
  await saved.search.fill('ftms');
  await saved.profile(devices.treadmill.name).click();
  await expect(new DeviceProfilePage(page).verdict).toBeVisible();
  expect(fakeBluetooth.writes()).toEqual([]);
});

// Given two investigations in storage, cancelling keeps both. Confirmation
// deletes only the selected investigation and the data it owns.
test('deletes one investigation and its evidence after confirmation', async ({
  page,
  fakeBluetooth,
}) => {
  const id = await finishTreadmill(page, fakeBluetooth);
  await seedStoredPhoto(page, id);
  await seedMissingTools(page, ['Rower kept']);
  const records = new StoredRecords(page);
  expect(await records.rawCount(id)).toBeGreaterThan(0);
  expect(await records.photoCount(id)).toBe(1);
  const home = new HomePage(page);
  await home.goto();
  await home.pastInvestigations.click();
  const history = new HistoryPage(page);
  const dialog = new DeleteInvestigationDialogPage(page);
  await history.deleteInvestigation(devices.treadmill.name).click({ timeout: 4_000 });
  await expect(dialog.cancel).toBeFocused();
  await dialog.cancel.click();
  await expect(history.investigationLinks).toHaveCount(2);
  expect(await records.investigation(id)).toBeDefined();
  await history.deleteInvestigation(devices.treadmill.name).click();
  await dialog.confirm.click();
  await expect(history.investigationLinks).toHaveCount(1);
  await page.reload();
  await expect(history.investigationLinks).toContainText('Rower kept');
  expect(await records.investigation(id)).toBeUndefined();
  expect(await records.rawCount(id)).toBe(0);
  expect(await records.photoCount(id)).toBe(0);
  expect(await records.recordings(id)).toEqual([]);
  expect(await records.profiles()).not.toContainEqual(
    expect.objectContaining({ investigationId: id }),
  );
});

// Given any stored investigation and settings, only the exact word DELETE enables
// the final action, after which this origin holds no Gattsby database.
test('deletes all data only after the exact typed confirmation', async ({
  page,
  fakeBluetooth,
}) => {
  const id = await finishTreadmill(page, fakeBluetooth);
  await seedStoredPhoto(page, id);
  const home = new HomePage(page);
  await home.goto();
  await home.settings.click();
  const settings = new SettingsPage(page);
  await settings.useAgent.uncheck();
  await settings.deleteAll.click({ timeout: 4_000 });
  const dialog = new DeleteAllDataDialogPage(page);
  await expect(dialog.cancel).toBeFocused();
  await expect(dialog.confirm).toBeDisabled();
  await dialog.confirmation.fill('delete');
  await expect(dialog.confirm).toBeDisabled();
  await dialog.confirmation.fill('DELETE ');
  await expect(dialog.confirm).toBeDisabled();
  await dialog.confirmation.fill('DELETE');
  await expect(dialog.confirm).toBeEnabled();
  await dialog.confirm.click();
  await expect(home.identifyADevice).toBeVisible();
  await expect(home.dataDeleted).toBeVisible();
  await expect(home.pastInvestigations).toHaveCount(0);
  expect(await new StoredRecords(page).databasePresent()).toBe(false);
});

// Given a browser estimate above 90%, the History page names the limit and
// explains how the person can keep and remove older investigations.
test('explains how to free space when browser storage is nearly full', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(StorageManager.prototype, 'estimate', {
      value: async () => ({ usage: 92_000_000, quota: 100_000_000 }),
    });
  });
  const home = new HomePage(page);
  await home.goto();
  await seedMissingTools(page, ['Rower']);
  await home.goto();
  await home.pastInvestigations.click();
  const history = new HistoryPage(page);
  await expect(history.storage).toContainText('92 MB used of 100 MB available');
  await expect(history.storageWarning).toContainText('Export old investigations');
});

// Given a completed investigation and a newer one stopped in Prepare, when the
// person opens History, then both appear and the stopped verdict can be reopened.
test('opens a stopped investigation from the newest-first history @critical', async ({
  page,
  fakeBluetooth,
}) => {
  const first = await finishTreadmill(page, fakeBluetooth);
  const home = new HomePage(page);
  await home.goto();
  await home.identify();
  const investigation = new InvestigationPage(page);
  await investigation.waitForPrompt('What kind of machine is it?');
  const second = investigation.id();
  await investigation.chooseOption('Stop and get a verdict now');
  await new StopInvestigationDialogPage(page).choose('Stop and get a verdict');
  const verdict = new VerdictPage(page);
  await expect(verdict.title).toHaveText('Stopped by the person');
  await home.goto();
  await expect(home.pastInvestigations).toBeVisible();
  await home.pastInvestigations.click();
  const history = new HistoryPage(page);
  await expect(history.title).toBeVisible();
  await expect(history.storage).toBeVisible();
  await expect(history.investigationLinks).toHaveCount(2);
  await expect(history.investigationLinks.nth(0)).toHaveAttribute(
    'href',
    `/investigations/${second}/verdict`,
  );
  await expect(history.investigationLinks.nth(1)).toHaveAttribute(
    'href',
    `/investigations/${first}/verdict`,
  );
  await expect(history.investigationLinks.nth(0)).toContainText('Stopped by the person');
  await history.investigationLinks.nth(0).click();
  await expect(verdict.title).toHaveText('Stopped by the person');
  expect(fakeBluetooth.writes()).toEqual([]);
});
