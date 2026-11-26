// Traces to: FR-009, FR-018, FR-045, FR-051, FR-060, TOOL-008, TOOL-032
// Given a connected investigation, when the person confirms Stop, Gattsby releases
// the connection and saves a single verdict with the earlier evidence.

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { LeaveInvestigationDialogPage } from './pages/leave-investigation.dialog.page';
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

// Given a connected investigation, when the person confirms Leave, the device is
// disconnected and Home offers the saved investigation at the same stage.
test('keeps the investigation when the person stays and saves it when they leave', async ({
  page,
  fakeBluetooth,
}) => {
  const { home, investigation } = await identify(page);
  const id = investigation.id();
  const stored = new StoredRecords(page);
  const dialog = new LeaveInvestigationDialogPage(page);
  await investigation.leave.click();
  await expect(dialog.dialog).toBeVisible();
  await dialog.choose('Stay');
  await expect(investigation.answer('Ready')).toBeVisible();
  expect(fakeBluetooth.calls()).not.toContain('disconnect');
  await investigation.leave.click();
  await dialog.choose('Leave and disconnect');
  await expect(home.resumeInvestigation('HZN-T202-4F1A')).toContainText('Paused at Standard path');
  expect(fakeBluetooth.calls()).toContain('disconnect');
  expect(await stored.investigation(id)).toMatchObject({ status: 'paused', verdict: null });
});

for (const getDevices of [true, false]) {
  test.describe(getDevices ? 'Chrome remembers the device' : 'Chrome needs a new selection', () => {
    test.use({
      bluetooth: {
        devices: [devices.treadmill.id],
        chooser: [{ pick: devices.treadmill.id }],
        permittedCandidates: getDevices ? [devices.treadmill.id] : [],
        permittedDevicesUnavailable: !getDevices,
      },
    });

    // Given an interrupted investigation, when the person resumes from Home, Gattsby
    // reconnects to the original device before asking the question it was about to ask.
    test('resumes an interrupted investigation and keeps its recorded evidence', async ({
      page,
      fakeBluetooth,
    }) => {
      await page.clock.install();
      const { home, investigation } = await identify(page);
      const id = investigation.id();
      const records = new StoredRecords(page);
      const earlier = await records.steps(id);
      const raw = await records.rawLog(id);
      await home.goto();
      await home.resumeInvestigation('HZN-T202-4F1A').click();
      if (!getDevices) await investigation.choose('Find the device');
      await expect(investigation.connectionBanner).toContainText('Reconnecting to');
      await page.clock.runFor(1_200);
      await expect(investigation.answer('Ready')).toBeVisible();
      expect(investigation.id()).toBe(id);
      const steps = await records.steps(id);
      expect(steps.slice(0, earlier.length)).toEqual(earlier);
      expect(steps.slice(earlier.length).map(({ tool }) => tool)).toContain('reconnect');
      expect((await records.rawLog(id)).slice(0, raw.length)).toEqual(raw);
      expect(fakeBluetooth.calls().filter((name) => name === 'connect')).toHaveLength(2);
      expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(getDevices ? 1 : 2);
      expect(fakeBluetooth.writes()).toEqual([]);
    });

    if (getDevices) {
      test('restores saved baseline data and live readings on resume', async ({
        page,
        fakeBluetooth,
      }) => {
        await page.clock.install();
        const { home, investigation } = await identify(page);
        const id = investigation.id();
        const records = new StoredRecords(page);
        await fakeBluetooth.setEffort(1);
        await investigation.choose('Ready');
        await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
        await page.clock.runFor(10_200);
        await expect(investigation.answer('Done')).toBeVisible();
        const earlier = await records.recordings(id);
        await home.goto();
        await home.resumeInvestigation('HZN-T202-4F1A').click();
        await expect(investigation.connectionBanner).toContainText('Reconnecting to');
        await fakeBluetooth.setEffort(1);
        await page.clock.runFor(1_200);
        await expect(investigation.answer('Done')).toBeVisible();
        await page.clock.runFor(1_100);
        await expect(investigation.liveMetric('Speed')).toContainText('3.0');
        expect(await records.recordings(id)).toEqual(earlier);
        expect(fakeBluetooth.writes()).toEqual([]);
      });
    }
  });
}
