// Traces to: FR-009, FR-010, FR-061, FR-065, NFR-008
import { finishTreadmill } from './fixtures/finish-treadmill';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { DeviceProfilePage } from './pages/device-profile.page';
import { HistoryPage } from './pages/history.page';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StopInvestigationDialogPage } from './pages/stop-investigation.dialog.page';
import { SavedDevicesPage } from './pages/saved-devices.page';
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
