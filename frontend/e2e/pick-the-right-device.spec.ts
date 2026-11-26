// Traces to: FR-013, FR-058, NFR-013, TOOL-004, TOOL-005
// Given a chooser full of look-alikes and no advertisement API, when the person selects the device
// that disappeared and returned, then Gattsby connects to that device and records the guided match.

import { LOOK_ALIKE_TREADMILLS } from '../src/simulation/devices/look-alike-treadmills.device';
import { expect, test } from './fixtures/gattsby-test';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';

const selected = LOOK_ALIKE_TREADMILLS[2];
const selectedDeviceId = `sim-${selected.id}`;
test.use({
  bluetooth: {
    devices: LOOK_ALIKE_TREADMILLS.map(({ id }) => id),
    chooser: [{ cancel: true }, { pick: selected.id }],
  },
});

test('connects to the returning candidate chosen in Chrome @critical', async ({
  page,
  fakeBluetooth,
}) => {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await investigation.choose('Several names look alike');
  await investigation.waitForPrompt('Which names look alike?');
  await investigation.typeAnswer(LOOK_ALIKE_TREADMILLS.map(({ name }) => name).join(', '));
  await investigation.waitForPrompt('Pick the one that comes back');
  for (const { name } of LOOK_ALIKE_TREADMILLS) {
    await expect(investigation.feedTool('report_candidate_names')).toContainText(name);
  }
  expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(1);
  expect(fakeBluetooth.calls()).not.toContain('connect');
  await expect(investigation.promptDetail).toContainText('about 5 seconds');
  await investigation.choose('Find the device');
  await expect(investigation.feedTool('power_cycle_match')).toContainText(
    `You picked ${selected.name} after it disappeared and came back.`,
  );
  await expect(investigation.panelValue('Advertised name')).toHaveText(selected.name);
  const id = investigation.id();
  const records = new StoredRecords(page);
  await expect
    .poll(() => records.observations(id))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'candidate-match',
          subject: selectedDeviceId,
          value: 'guided',
        }),
        expect.objectContaining({ kind: 'connected', subject: selectedDeviceId }),
      ]),
    );
  expect(await records.missingToolRequests(id)).toContainEqual(
    expect.objectContaining({ capabilityKey: 'watch-advertisements' }),
  );
  expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(2);
  expect(fakeBluetooth.writes()).toEqual([]);
});

for (const scanner of ['watchAdvertisements', 'requestLEScan'] as const) {
  test.describe(`The browser supports ${scanner} for previously permitted candidates`, () => {
    test.use({
      bluetooth: {
        devices: LOOK_ALIKE_TREADMILLS.map(({ id }) => id),
        chooser: [{ cancel: true }],
        permittedCandidates: LOOK_ALIKE_TREADMILLS.map(({ id }) => id),
        watchAdvertisements: scanner === 'watchAdvertisements',
        advertisementScanning: scanner === 'requestLEScan',
      },
    });

    test('uses a unique advertisement gap to match the returning device', async ({
      page,
      fakeBluetooth,
    }) => {
      const home = new HomePage(page);
      const investigation = new InvestigationPage(page);
      await home.goto();
      await home.identify();
      await investigation.prepare('Treadmill', 'Don’t know');
      await investigation.choose('Find the device');
      await investigation.choose('Several names look alike');
      await investigation.choose('Continue without the names');
      await investigation.waitForPrompt('Watch the nearby candidates');
      await investigation.choose('Start watching');
      await expect
        .poll(() => fakeBluetooth.calls().filter((call) => call === scanner).length)
        .toBe(scanner === 'watchAdvertisements' ? 4 : 1);
      await page.clock.runFor(2_250);
      await investigation.waitForPrompt('Turn the treadmill off and on');
      await fakeBluetooth.setAdvertising(selected.id, false);
      await page.clock.runFor(5_000);
      await fakeBluetooth.setAdvertising(selected.id, true);
      await page.clock.runFor(1_100);
      await investigation.choose('Done');
      await page.clock.runFor(2_100);
      await expect(investigation.feedTool('power_cycle_match')).toContainText(selected.name);
      const id = investigation.id();
      const records = new StoredRecords(page);
      await expect
        .poll(() => records.observations(id))
        .toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: 'candidate-match',
              subject: selectedDeviceId,
              value: 'automatic',
            }),
            expect.objectContaining({ kind: 'connected', subject: selectedDeviceId }),
          ]),
        );
      expect(await records.rawLog(id)).toContainEqual(
        expect.objectContaining({
          kind: 'advertisement',
          detail: expect.stringContaining('"0x0102":"A1 B2"'),
        }),
      );
      const stopped = scanner === 'watchAdvertisements' ? 'stopAdvertisements' : 'stopLEScan';
      expect(fakeBluetooth.calls().filter((call) => call === stopped)).toHaveLength(
        scanner === 'watchAdvertisements' ? 4 : 1,
      );
      expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(1);
      expect(fakeBluetooth.writes()).toEqual([]);
    });
  });
}

test.describe('No look-alike has been permitted yet', () => {
  test.use({
    bluetooth: {
      devices: LOOK_ALIKE_TREADMILLS.map(({ id }) => id),
      chooser: [{ cancel: true }, { pick: selected.id }],
      watchAdvertisements: true,
    },
  });

  test('uses the guided chooser even when the browser has a watch API', async ({
    page,
    fakeBluetooth,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.prepare('Treadmill', 'Don’t know');
    await investigation.choose('Find the device');
    await investigation.choose('Several names look alike');
    await investigation.choose('Continue without the names');
    await investigation.waitForPrompt('Pick the one that comes back');
    expect(fakeBluetooth.calls()).not.toContain('watchAdvertisements');
    expect(fakeBluetooth.requestDeviceOptions()).toHaveLength(1);
    await investigation.choose('Find the device');
    await expect(investigation.panelValue('Advertised name')).toHaveText(selected.name);
  });
});
