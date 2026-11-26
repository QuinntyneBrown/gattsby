// Traces to: FR-034, FR-035, FR-036, FR-037, FR-038, FR-039, FR-040, NFR-018, NFR-019, TOOL-021, TOOL-022, TOOL-024
// Given a confirmed FTMS treadmill, when the person skips the optional Control stage,
// then it reaches a verdict with the read evidence and sends no command.

import type { Page } from '@playwright/test';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { expect, test } from './fixtures/gattsby-test';
import { devices, treadmill } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { ApprovalDialogPage } from './pages/approval.dialog.page';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

async function reachControl(page: Page, fakeBluetooth: FakeBluetooth) {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(10_500);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  await fakeBluetooth.setEffort(2);
  await page.clock.runFor(2_100);
  await investigation.choose('Done');
  await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
  await investigation.choose('Skip');
  await investigation.waitForPrompt('Test control?');
  return investigation;
}

test('keeps control optional and records a read-only choice', async ({ page, fakeBluetooth }) => {
  const investigation = await reachControl(page, fakeBluetooth);
  await expect(investigation.subtitle).toHaveText('Agent · Control');
  expect(fakeBluetooth.writes()).toEqual([]);
  await investigation.choose('Skip — finish read-only');
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  expect(fakeBluetooth.writes()).toEqual([]);
  const records = new StoredRecords(page);
  expect(await records.observations(investigation.id())).toContainEqual(
    expect.objectContaining({ kind: 'answer', subject: 'Test control?', value: 'Skipped' }),
  );
});

test('refuses Request Control when the person declines the approval', async ({
  page,
  fakeBluetooth,
}) => {
  const investigation = await reachControl(page, fakeBluetooth);
  const approval = new ApprovalDialogPage(page);
  await investigation.choose('Test control');
  await expect(approval.dialog).toContainText('Request control?');
  await expect(approval.dialog).toContainText('Fitness Machine Control Point (0x2AD9)');
  await expect(approval.standClear).toHaveCount(0);
  expect(fakeBluetooth.writes()).toEqual([]);
  await approval.dontSend.click();
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  expect(fakeBluetooth.writes()).toEqual([]);
  const steps = await new StoredRecords(page).steps(investigation.id());
  expect(steps.filter((step) => step.tool === 'request_control')).toEqual([
    expect.objectContaining({
      result: expect.objectContaining({
        error: expect.objectContaining({ code: 'APPROVAL_DENIED' }),
      }),
    }),
  ]);
});

test('requests control once after approval and records the indication', async ({
  page,
  fakeBluetooth,
  approvals,
}) => {
  const investigation = await reachControl(page, fakeBluetooth);
  const approval = new ApprovalDialogPage(page);
  await investigation.choose('Test control');
  await expect(approval.dialog).toContainText('Request control?');
  expect(fakeBluetooth.writes()).toEqual([]);
  await approval.approve(approvals, treadmill.controlPoint, [0x00]);
  const id = investigation.id();
  const records = new StoredRecords(page);
  await expect
    .poll(() => records.steps(id))
    .toContainEqual(
      expect.objectContaining({
        tool: 'request_control',
        result: expect.objectContaining({
          ok: true,
          data: expect.objectContaining({ result: 'success', raw: '80 00 01' }),
        }),
      }),
    );
  expect(fakeBluetooth.writes()).toEqual([
    expect.objectContaining({ characteristic: treadmill.controlPoint, bytes: [0x00] }),
  ]);
  expect(await records.rawLog(id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'write', hex: '00', approvalId: expect.any(String) }),
      expect.objectContaining({ kind: 'indication', hex: '80 00 01' }),
    ]),
  );
});

test('approves one conservative speed step, confirms its effect and separately approves Stop @critical', async ({
  page,
  fakeBluetooth,
  approvals,
}) => {
  const investigation = await reachControl(page, fakeBluetooth);
  const approval = new ApprovalDialogPage(page);
  await investigation.choose('Test control');
  await approval.approve(approvals, treadmill.controlPoint, [0x00]);
  await expect(approval.dialog).toContainText('Lower the target speed to 5.9 km/h?');
  await expect(approval.send).toBeDisabled();
  await expect(approval.dialog).toContainText('locate its physical stop key or button');
  expect(fakeBluetooth.writes().map((write) => write.bytes)).toEqual([[0x00]]);
  await approval.standClear.check();
  await approval.approve(approvals, treadmill.controlPoint, [0x02, 0x4e, 0x02]);
  await investigation.waitForPrompt('Does the console show 5.9 km/h?');
  await page.clock.runFor(1_100);
  await investigation.choose('Yes, 5.9');
  await expect(approval.dialog).toContainText('Stop the belt?');
  await expect(approval.standClear).toHaveCount(0);
  expect(fakeBluetooth.writes().map((write) => write.bytes)).toEqual([[0x00], [0x02, 0x4e, 0x02]]);
  await approval.approve(approvals, treadmill.controlPoint, [0x08, 0x01]);
  const verdict = new VerdictPage(page);
  await expect(verdict.title).toHaveText('Connected — FTMS');
  await expect(verdict.item('Can control', 'Target speed')).toContainText('confirmed');
  expect(fakeBluetooth.writes().map((write) => write.bytes)).toEqual([
    [0x00],
    [0x02, 0x4e, 0x02],
    [0x08, 0x01],
  ]);
  const records = new StoredRecords(page);
  const writes = (await records.rawLog(investigation.id())).filter(
    (entry) => entry.kind === 'write',
  );
  expect(new Set(writes.map((entry) => entry.approvalId)).size).toBe(3);
});

test('refuses the approved value if the live speed changes while the dialog is open', async ({
  page,
  fakeBluetooth,
  approvals,
}) => {
  const investigation = await reachControl(page, fakeBluetooth);
  const approval = new ApprovalDialogPage(page);
  await investigation.choose('Test control');
  await approval.approve(approvals, treadmill.controlPoint, [0x00]);
  await expect(approval.dialog).toContainText('Lower the target speed to 5.9 km/h?');
  await fakeBluetooth.setEffort(3);
  await page.clock.runFor(1_200);
  await approval.standClear.check();
  await approval.send.click();
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  expect(fakeBluetooth.writes().map((write) => write.bytes)).toEqual([[0x00]]);
  expect(await new StoredRecords(page).steps(investigation.id())).toContainEqual(
    expect.objectContaining({
      tool: 'send_command',
      result: expect.objectContaining({ error: expect.objectContaining({ code: 'UNSAFE_VALUE' }) }),
    }),
  );
});

test.describe('The FTMS bike reports resistance and its range', () => {
  test.use({ bluetooth: { devices: [devices.bike.id], chooser: [{ pick: devices.bike.id }] } });

  test('offers one resistance increment and confirms it with live evidence', async ({
    page,
    fakeBluetooth,
    approvals,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    const approval = new ApprovalDialogPage(page);
    await home.goto();
    await home.identify();
    await investigation.prepare('Bike', 'Don’t know');
    await investigation.choose('Find the device');
    await fakeBluetooth.setEffort(1);
    await investigation.choose('Ready');
    await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
    await page.clock.runFor(10_500);
    await investigation.waitForPrompt('Now pedal faster.');
    await fakeBluetooth.setEffort(2);
    await page.clock.runFor(1_100);
    await investigation.choose('Done');
    await investigation.choose('Test control');
    await approval.approve(approvals, treadmill.controlPoint, [0x00]);
    await expect(approval.dialog).toContainText('Raise the target resistance to 4?');
    await expect(approval.send).toBeDisabled();
    await approval.standClear.check();
    await approval.approve(approvals, treadmill.controlPoint, [0x04, 0x28, 0x00]);
    await investigation.waitForPrompt('Did the resistance change?');
    await page.clock.runFor(1_100);
    await investigation.choose('Yes');
    await expect(approval.dialog).toContainText('Stop the test?');
    await approval.approve(approvals, treadmill.controlPoint, [0x08, 0x01]);
    const verdict = new VerdictPage(page);
    await expect(verdict.item('Can control', 'Target resistance')).toContainText('confirmed');
    expect(fakeBluetooth.writes().map((write) => write.bytes)).toEqual([
      [0x00],
      [0x04, 0x28, 0x00],
      [0x08, 0x01],
    ]);
  });
});
