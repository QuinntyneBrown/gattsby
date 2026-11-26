// Acceptance Test
// Traces to: FR-011, FR-012, FR-015, FR-017, FR-018, FR-019, FR-020, FR-021, FR-023, FR-045,
//   FR-046, FR-048, FR-053, FR-054, FR-057, FR-060, FR-066, FR-067, FR-073, NFR-013, TOOL-002,
//   TOOL-003, TOOL-006, TOOL-008, TOOL-009, TOOL-010, TOOL-011, TOOL-012, TOOL-030
// Description: Find, connect to and identify a standard machine, and end with one verdict

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/gattsby-test';
import { devices, uuids } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { LeaveInvestigationDialogPage } from './pages/leave-investigation.dialog.page';
import { VerdictPage } from './pages/verdict.page';

async function startAndPrepare(page: Page, machineType: string): Promise<InvestigationPage> {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare(machineType, 'Don’t know');
  await investigation.waitForPrompt('Find the device');
  return investigation;
}

test.describe('Identify a standard machine', () => {
  test.describe('an FTMS treadmill', () => {
    test.use({
      bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
    });

    test(
      'Given an FTMS treadmill, when the person runs the investigation, then it names the protocol and ends with one verdict',
      { tag: '@critical' },
      async ({ page, fakeBluetooth, fakeModel }) => {
        const investigation = await startAndPrepare(page, 'Treadmill');
        expect(fakeBluetooth.calls()).not.toContain('requestDevice');

        await investigation.choose('Find the device');
        await investigation.choose('Skip');

        const verdict = new VerdictPage(page);
        await expect(verdict.title).toHaveText('Partially decoded');
        await expect(verdict.protocol).toHaveText(
          'FTMS · Treadmill (0x1826) · not verified with live data',
        );
        await expect(verdict.meta).toContainText(
          'T202 treadmill · Johnson Health Tech · firmware 2.14.0',
        );
        await expect(verdict.summary).toHaveText(
          'Identified as FTMS from its services and Device Information. No metric has been confirmed with live data yet.',
        );
        await expect(verdict.item('Observed', 'Maker')).toContainText('Johnson Health Tech');
        await expect(verdict.item('Couldn’t determine', 'Services Chrome hides')).toBeVisible();
        await expect(verdict.newInvestigation).toBeInViewport();

        const id = /\/investigations\/([^/]+)\/verdict$/.exec(page.url())![1];
        const stored = await new StoredRecords(page).investigation(id);
        expect(stored?.verdict).toMatchObject({
          kind: 'partiallyDecoded',
          label: 'Partially decoded',
        });
        expect(stored?.status).toBe('concluded');
        expect(fakeBluetooth.calls().at(-1)).toBe('disconnect');
        expect(fakeModel.prompts()).toEqual([]);
        expect(fakeModel.calls().filter((method) => method === 'create')).toHaveLength(1);
      },
    );

    test('Given the Find prompt, when the person taps "Find the device", then the chooser is filtered to the known services and passes every known service as optional', async ({
      page,
      fakeBluetooth,
    }) => {
      const investigation = await startAndPrepare(page, 'Treadmill');

      await investigation.choose('Find the device');

      await expect.poll(() => fakeBluetooth.requestDeviceOptions().length).toBe(1);
      const [options] = fakeBluetooth.requestDeviceOptions();
      expect('filters' in options && options.filters).toContainEqual({
        services: [uuids.fitnessMachine],
      });
      for (const known of [
        uuids.fitnessMachine,
        uuids.deviceInformation,
        uuids.heartRate,
        uuids.battery,
        uuids.cyclingPower,
        uuids.cyclingSpeedCadence,
        uuids.runningSpeedCadence,
      ]) {
        expect(options.optionalServices).toContain(known);
      }
      expect(options.optionalServices).not.toContain(uuids.humanInterfaceDevice);
    });
  });

  test.describe('an FTMS treadmill held on its last read', () => {
    test.use({
      bluetooth: {
        devices: [devices.treadmill.id],
        chooser: [{ pick: devices.treadmill.id }],
        readDelays: { [uuids.supportedSpeedRange]: 60_000 },
      },
    });

    test('Given a connected treadmill, when the layout is read, then the feed lists its services and the hypothesis forms with confidence and evidence', async ({
      page,
    }) => {
      const investigation = await startAndPrepare(page, 'Treadmill');

      await investigation.choose('Find the device');

      await expect(investigation.feedTool('connect')).toContainText('Connected.');
      await expect(investigation.feedTool('enumerate_gatt')).toContainText(
        '3 services, 3 of them standard.',
      );
      await expect(investigation.feedTool('enumerate_gatt')).toContainText(
        'Fitness Machine (0x1826)',
      );
      await expect(
        investigation.feed
          .locator('.hypo-change')
          .filter({ hasText: 'Standard fitness machine (FTMS)' })
          .first(),
      ).toContainText('35%');
      await expect(investigation.feedTool('read_device_info')).toContainText(
        'Maker Johnson Health Tech, model T202, firmware 2.14.0.',
      );
      await expect(investigation.feedTool('match_known_profiles')).toContainText(
        'Best match: FTMS treadmill, 95 of 100.',
      );
      await expect(investigation.feed.locator('.hypo-change').last()).toContainText(
        'FTMS treadmill',
      );
      await expect(investigation.feed.locator('.hypo-change').last()).toContainText('65%');
    });
  });

  test.describe('an FTMS treadmill that is slow to give its maker', () => {
    test.use({
      bluetooth: {
        devices: [devices.treadmill.id],
        chooser: [{ pick: devices.treadmill.id }],
        readDelays: { [uuids.manufacturerName]: 4000 },
        omitCharacteristics: [0x2ad9],
      },
    });

    test('Given the maker is being read, when the person looks at the screen, then the stage reads Identify and the step reads "Reading the maker and model"', async ({
      page,
    }) => {
      const investigation = await startAndPrepare(page, 'Treadmill');

      await investigation.choose('Find the device');

      await expect(investigation.promptTitle).toHaveText('Reading the maker and model');
      expect(await investigation.currentStage()).toBe('Identify');
      await expect(investigation.subtitle).toHaveText('Agent · Identify');
      await expect(investigation.panelValue('Advertised name')).toHaveText(devices.treadmill.name);
      await expect(investigation.panelValue('Services')).toHaveText('0x1826 0x180A 0x180D');
      await expect(investigation.emergencyStop).toBeVisible();
    });

    test('Given a connected device, when the person taps "Emergency stop", then the loop stops, the device is released and the verdict says so', async ({
      page,
      fakeBluetooth,
    }) => {
      const investigation = await startAndPrepare(page, 'Treadmill');
      await investigation.choose('Find the device');
      await expect(investigation.promptTitle).toHaveText('Reading the maker and model');

      await investigation.emergencyStop.click();

      const verdict = new VerdictPage(page);
      await expect(verdict.summary).toContainText('Emergency stop used');
      await expect(verdict.title).toHaveText('Needs a missing tool');
      expect(fakeBluetooth.calls()).toContain('disconnect');
      expect(fakeBluetooth.writes()).toEqual([]);
    });

    test('Given a connected device, when the person leaves the investigation, then the device is disconnected', async ({
      page,
      fakeBluetooth,
    }) => {
      const investigation = await startAndPrepare(page, 'Treadmill');
      await investigation.choose('Find the device');
      await expect(investigation.promptTitle).toHaveText('Reading the maker and model');

      await investigation.leave.click();
      await new LeaveInvestigationDialogPage(page).choose('Leave and disconnect');

      await expect(new HomePage(page).identifyADevice).toBeVisible();
      expect(fakeBluetooth.calls()).toContain('disconnect');
    });
  });

  test.describe('a closed chooser', () => {
    test.use({
      bluetooth: {
        devices: [devices.treadmill.id],
        chooser: [{ cancel: true }, { pick: devices.treadmill.id }],
      },
    });

    test('Given the person closes the chooser, when Gattsby continues, then it offers every nearby device and the open scan accepts all devices', async ({
      page,
      fakeBluetooth,
    }) => {
      const investigation = await startAndPrepare(page, 'Treadmill');
      await investigation.choose('Find the device');

      await investigation.waitForPrompt('Not in the list?');
      await expect(investigation.answer('Scan again')).toBeVisible();
      await expect(investigation.feedTool('scan_devices')).toContainText(
        'You closed the list without choosing',
      );
      await investigation.choose('Show all nearby devices');

      await expect.poll(() => fakeBluetooth.requestDeviceOptions().length).toBe(2);
      const [, open] = fakeBluetooth.requestDeviceOptions();
      expect(open).toMatchObject({ acceptAllDevices: true });
      expect(open.optionalServices).toContain(uuids.fitnessMachine);
    });
  });

  test.describe('a device another app holds', () => {
    test.use({
      bluetooth: { devices: [devices.heldByOther.id], chooser: [{ pick: devices.heldByOther.id }] },
    });

    test('Given the device refuses the connection, when Gattsby suspects another app, then it asks to disconnect it and reconnects on "Done"', async ({
      page,
    }) => {
      const investigation = await startAndPrepare(page, 'Treadmill');
      await investigation.choose('Find the device');

      await investigation.waitForPrompt('Disconnect other apps and watches');
      await expect(investigation.feedTool('connect').first()).toContainText(
        'Another app or watch may be holding the connection',
      );
      await expect(investigation.answer('Stop')).toBeVisible();
      await investigation.choose('Done');
      await investigation.choose('Skip');

      await expect(new VerdictPage(page).title).toHaveText('Partially decoded');
    });
  });

  test.describe('an FTMS bike', () => {
    test.use({ bluetooth: { devices: [devices.bike.id], chooser: [{ pick: devices.bike.id }] } });

    test('Given an FTMS bike, when the investigation runs, then it is identified as an FTMS indoor bike without Device Information', async ({
      page,
    }) => {
      const investigation = await startAndPrepare(page, 'Bike');

      await investigation.choose('Find the device');
      await investigation.choose('Skip');

      const verdict = new VerdictPage(page);
      await expect(verdict.title).toHaveText('Partially decoded');
      await expect(verdict.protocol).toHaveText(
        'FTMS · Indoor bike (0x1826) · not verified with live data',
      );
      await expect(verdict.summary).toHaveText(
        'Identified as FTMS from its services. No metric has been confirmed with live data yet.',
      );
      await expect(verdict.item('Observed', 'Fitness Machine Feature')).toContainText('Cadence');
    });
  });

  test.describe('a heart-rate strap', () => {
    test.use({ bluetooth: { devices: [devices.strap.id], chooser: [{ pick: devices.strap.id }] } });

    test('Given a heart-rate strap, when the investigation runs, then it is identified as Heart Rate and every packet is logged', async ({
      page,
    }) => {
      const investigation = await startAndPrepare(page, 'Heart-rate sensor');

      await investigation.choose('Find the device');
      await investigation.choose('Skip');

      const verdict = new VerdictPage(page);
      await expect(verdict.title).toHaveText('Partially decoded');
      await expect(verdict.protocol).toHaveText(
        'Heart Rate · Heart-rate sensor (0x180D) · not verified with live data',
      );
      await expect(verdict.item('Observed', 'Body Sensor Location')).toContainText('Chest');
      const id = /\/investigations\/([^/]+)\/verdict$/.exec(page.url())![1];
      const log = await new StoredRecords(page).rawLog(id);
      expect(log.map((e) => e.kind)).toEqual(
        expect.arrayContaining(['scan', 'connect', 'read', 'disconnect']),
      );
      const read = log.find((e) => e.kind === 'read' && e.uuid === uuids.manufacturerName);
      expect(read?.hex).toBe('50 6F 6C 61 72 20 45 6C 65 63 74 72 6F 20 4F 79');
      // Milliseconds since the epoch (FR-073 AC2).
      expect(read!.t).toBeGreaterThan(Date.UTC(2020, 0, 1));
    });
  });

  test.describe('a device named with markup', () => {
    test.use({
      bluetooth: { devices: [devices.hostile.id], chooser: [{ pick: devices.hostile.id }] },
    });

    test('Given a device named <img src=x onerror=alert(1)>, when it is shown, then the name and its maker appear literally and no script runs', async ({
      page,
    }) => {
      const investigation = await startAndPrepare(page, 'Bike');

      await investigation.choose('Find the device');

      await expect(investigation.title).toHaveText(devices.hostile.name);
      await expect(investigation.panelValue('Advertised name')).toHaveText(devices.hostile.name);
      await investigation.choose('Skip');
      const verdict = new VerdictPage(page);
      await expect(verdict.title).toHaveText('Partially decoded');
      await expect(verdict.item('Observed', 'Maker')).toContainText('<script>alert(1)</script>');
      await expect(verdict.meta).toContainText('<script>alert(1)</script>');
    });
  });
  test.describe('a device with only unknown services', () => {
    test.use({
      bluetooth: {
        devices: [devices.unknown.id],
        chooser: [{ cancel: true }, { pick: devices.unknown.id }],
      },
    });

    test('Given a device whose services the knowledge base lacks, when the rules cannot name a protocol, then the investigation still ends with one verdict', async ({
      page,
      fakeModel,
    }) => {
      const investigation = await startAndPrepare(page, 'Rower');
      await investigation.choose('Find the device');
      await investigation.waitForPrompt('Not in the list?');

      await investigation.choose('Show all nearby devices');

      const verdict = new VerdictPage(page);
      await expect(verdict.title).toHaveText('Needs a missing tool');
      await expect(verdict.missingToolRequests).toHaveText(['Identify this device’s protocol']);
      expect(fakeModel.prompts()).toEqual([]);
    });
  });
});
