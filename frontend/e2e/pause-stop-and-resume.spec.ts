// Traces to: FR-009, FR-018, FR-045, FR-051, FR-060, TOOL-008, TOOL-032
// Given a connected investigation, when the person confirms Stop, Gattsby releases
// the connection and saves a single verdict with the earlier evidence.

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StopInvestigationDialogPage } from './pages/stop-investigation.dialog.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

async function identify(page: Page) {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await expect(investigation.answer('Ready')).toBeVisible();
  return { home, investigation };
}

test('shows a confirmation before stopping and releasing the connection @critical', async ({
  page,
  fakeBluetooth,
}) => {
  const { investigation } = await identify(page);
  const id = investigation.id();
  const stored = new StoredRecords(page);
  const earlier = await stored.steps(id);
  const dialog = new StopInvestigationDialogPage(page);
  await investigation.chooseOption('Stop and get a verdict now');
  await expect(dialog.dialog).toBeVisible();
  await dialog.choose('Keep going');
  await expect(investigation.answer('Ready')).toBeVisible();
  expect(fakeBluetooth.calls()).not.toContain('disconnect');
  await investigation.chooseOption('Stop and get a verdict now');
  await dialog.choose('Stop and get a verdict');
  await expect(new VerdictPage(page).title).toHaveText('Stopped by the person');
  expect(fakeBluetooth.writes()).toEqual([]);
  expect(fakeBluetooth.calls()).toContain('disconnect');
  const steps = await stored.steps(id);
  expect(steps.slice(0, earlier.length)).toEqual(earlier);
  expect(steps.filter((step) => step.tool === 'finish')).toHaveLength(1);
});
