// Traces to: FR-032, FR-033, FR-068, TOOL-020, TOOL-023
import { expect, test } from './fixtures/gattsby-test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  MOVESENSE_COMMAND,
  MOVESENSE_DATA,
  MOVESENSE_SUBSCRIPTION,
} from '../src/simulation/devices/movesense.device';
import type { FakeBluetooth } from './fixtures/fake-bluetooth';
import { StoredRecords } from './fixtures/stored-records';
import { ApprovalDialogPage } from './pages/approval.dialog.page';
import { DeviceProfilePage } from './pages/device-profile.page';
import { ExportDialogPage } from './pages/export.dialog.page';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StopInvestigationDialogPage } from './pages/stop-investigation.dialog.page';
import { VerdictPage } from './pages/verdict.page';

test.describe('A Movesense sensor offers its documented data service', () => {
  test.use({
    bluetooth: {
      devices: ['movesense-sensor'],
      chooser: [{ cancel: true }, { pick: 'movesense-sensor' }],
    },
  });

  test('identifies the vendor using the name and exposed service', async ({
    page,
    fakeBluetooth,
  }) => {
    const investigation = await findSensor(page);
    await expect(investigation.feedTool('vendor_signature_lookup')).toContainText('Movesense', {
      timeout: 4_000,
    });
    expect(fakeBluetooth.writes()).toEqual([]);
  });

  // Given the exposed GSP characteristics are silent, the one approved
  // subscription starts notification data and the profile records it.
  test('sends one approved subscription and saves the data evidence', async ({
    page,
    fakeBluetooth,
    approvals,
  }) => {
    const investigation = await recordSilence(page, fakeBluetooth);
    const dialog = new ApprovalDialogPage(page);
    await expect(dialog.dialog).toContainText('Movesense GATT SensorData Protocol', {
      timeout: 4_000,
    });
    await expect(dialog.dialog).toContainText('01 01 2F 4D 65 61 73 2F 41 63 63 2F 31 33');
    expect(fakeBluetooth.writes()).toEqual([]);
    await dialog.approve(approvals, MOVESENSE_COMMAND, MOVESENSE_SUBSCRIPTION);
    await expect.poll(() => fakeBluetooth.writes().length).toBe(1);
    await page.clock.runFor(10_500);
    const id = investigation.id();
    const records = new StoredRecords(page);
    await expect
      .poll(async () =>
        (await records.steps(id)).find(({ tool }) => tool === 'replay_known_handshake'),
      )
      .toMatchObject({ result: { ok: true, data: { dataStarted: true } } });
    await investigation.chooseOption('Stop and get a verdict now');
    await new StopInvestigationDialogPage(page).choose('Stop and get a verdict');
    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Stopped by the person');
    const packets = await records.rawLog(id);
    const write = packets.find(({ kind }) => kind === 'write');
    expect(write).toMatchObject({
      uuid: MOVESENSE_COMMAND,
      source: 'handshake:movesense/accelerometer#1',
      approvalId: expect.stringMatching(/^a-/),
    });
    expect(packets).toContainEqual(
      expect.objectContaining({ kind: 'notification', uuid: MOVESENSE_DATA }),
    );
    expect(await records.profiles()).toContainEqual(
      expect.objectContaining({
        handshake: expect.objectContaining({
          vendor: 'Movesense',
          characteristic: MOVESENSE_COMMAND,
        }),
      }),
    );
    expect(fakeBluetooth.writes()).toHaveLength(1);
    await verdict.exportRecord.click();
    const exporting = new ExportDialogPage(page);
    const saved = page.waitForEvent('download');
    await exporting.fullRecord.click();
    const file = await saved;
    const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
    expect(exported.formatVersion).toBe('1.2');
    expect(exported.rawLog).toContainEqual(
      expect.objectContaining({
        kind: 'write',
        source: 'handshake:movesense/accelerometer#1',
      }),
    );
    await exporting.done.click();
    await verdict.deviceProfile.click();
    await expect(new DeviceProfilePage(page).requiredHandshake).toContainText('Movesense');
  });

  test('does not send the displayed subscription when the person declines', async ({
    page,
    fakeBluetooth,
  }) => {
    const investigation = await recordSilence(page, fakeBluetooth);
    await new ApprovalDialogPage(page).dontSend.click({ timeout: 4_000 });
    const records = new StoredRecords(page);
    await expect
      .poll(async () =>
        (await records.steps(investigation.id())).find(
          ({ tool }) => tool === 'replay_known_handshake',
        ),
      )
      .toMatchObject({ result: { error: { code: 'APPROVAL_DENIED' } } });
    expect(fakeBluetooth.writes()).toEqual([]);
  });
});

async function findSensor(page: Page): Promise<InvestigationPage> {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Other', 'Don’t know');
  await investigation.choose('Find the device');
  await investigation.choose('Show all nearby devices');
  return investigation;
}

async function recordSilence(page: Page, fakeBluetooth: FakeBluetooth): Promise<InvestigationPage> {
  const investigation = await findSensor(page);
  await investigation.waitForPrompt('Keep the device still, then tap Ready');
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(10_500);
  return investigation;
}

test.describe('The device protects its characteristic', () => {
  test.use({
    bluetooth: {
      devices: ['protected-gatt'],
      chooser: [{ cancel: true }, { pick: 'protected-gatt' }],
    },
  });

  // Given Chrome refuses a read for insufficient encryption, the verdict links a
  // missing-tool request to that GATT event and the app does not repeat the read or write.
  test('records the protected read without trying another GATT operation on it @critical', async ({
    page,
    fakeBluetooth,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.prepare('Other', 'Don’t know');
    const id = investigation.id();
    await investigation.choose('Find the device');
    await investigation.choose('Show all nearby devices');

    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Needs a missing tool');
    await expect(verdict.summary).toContainText('protected');
    const records = new StoredRecords(page);
    const reads = (await records.rawLog(id)).filter((entry) => entry.kind === 'read');
    expect(reads).toHaveLength(1);
    const missing = (await records.missingToolRequests(id)).find(({ sources }) =>
      sources?.includes('encrypted'),
    );
    expect(missing?.evidence).toContain(reads[0].id);
    expect(fakeBluetooth.calls().filter((call) => call === 'readValue')).toHaveLength(1);
    expect(fakeBluetooth.writes()).toEqual([]);
  });
});
