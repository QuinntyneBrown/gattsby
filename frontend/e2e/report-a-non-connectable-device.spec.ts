// Traces to: FR-014, FR-054, TOOL-034
// Given two unrecognised scans, the person checks power, other connections, and range.
// A third scan either finds the device or yields a reachability assessment with evidence.

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';

async function checkUsualCauses(page: Page, powerAnswer = 'Yes, it’s awake') {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await investigation.choose('Show all nearby devices');
  await investigation.waitForPrompt('Is the console on and awake?');
  await investigation.choose(powerAnswer);
  await investigation.waitForPrompt('Is any other app or watch connected to it?');
  await investigation.choose('No, nothing else is connected');
  await investigation.waitForPrompt('Stand within 2 metres of the console');
  await investigation.choose('Done');
  return investigation;
}

test.describe('No Bluetooth Low Energy device in range', () => {
  test.use({
    bluetooth: { devices: [], chooser: [{ cancel: true }, { cancel: true }, { cancel: true }] },
  });

  test('explains an unreachable device after three unrecognised scans @critical', async ({
    page,
    fakeBluetooth,
  }) => {
    const investigation = await checkUsualCauses(page);
    const id = investigation.id();
    await investigation.choose('Show all nearby devices');
    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Not connectable');
    await expect(verdict.summary).toContainText('Bluetooth Classic, ANT+, Wi-Fi or USB');
    await expect(verdict.group('What might work instead')).toContainText('Bluetooth Low Energy');
    const records = new StoredRecords(page);
    const steps = await records.steps(id);
    expect(steps.filter((step) => step.tool === 'finish')).toHaveLength(1);
    expect(steps.find((step) => step.tool === 'assess_reachability')?.result.data).toMatchObject({
      reachable: 'no',
      likelyCauses: ['Bluetooth Classic', 'ANT+', 'Wi-Fi', 'USB'],
      ruledOut: ['off or asleep', 'held by another central', 'out of range'],
    });
    const raw = (await records.rawLog(id)).filter(({ kind }) => kind === 'scan');
    expect(raw).toHaveLength(3);
    const assessment = (await records.observations(id)).find(({ kind }) => kind === 'reachability');
    expect(assessment?.evidence).toEqual(expect.arrayContaining(raw.map(({ id }) => id)));
    expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(3);
    expect(fakeBluetooth.calls()).not.toContain('connect');
    expect(fakeBluetooth.writes()).toEqual([]);
  });

  test('reports uncertainty without naming a transport when a check is unanswered', async ({
    page,
    fakeBluetooth,
  }) => {
    const investigation = await checkUsualCauses(page, 'Don’t know');
    const id = investigation.id();
    await investigation.choose('Show all nearby devices');
    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Needs a missing tool');
    await expect(verdict.summary).toContainText('did not establish why');
    const steps = await new StoredRecords(page).steps(id);
    expect(steps.find((step) => step.tool === 'assess_reachability')?.result.data).toMatchObject({
      reachable: 'unknown',
      likelyCauses: ['off or asleep'],
    });
    expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(3);
    expect(fakeBluetooth.writes()).toEqual([]);
  });
});

test.describe('The device appears on the last scan', () => {
  test.use({
    bluetooth: {
      devices: [devices.treadmill.id],
      chooser: [{ cancel: true }, { cancel: true }, { pick: devices.treadmill.id }],
    },
  });

  test('continues with the device the person chooses', async ({ page, fakeBluetooth }) => {
    const investigation = await checkUsualCauses(page);
    await investigation.choose('Show all nearby devices');
    await expect(investigation.panelValue('Advertised name')).toHaveText(devices.treadmill.name);
    await expect(investigation.answer('Ready')).toBeVisible();
    expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(3);
    expect(fakeBluetooth.calls()).toContain('connect');
    expect(fakeBluetooth.writes()).toEqual([]);
  });
});
