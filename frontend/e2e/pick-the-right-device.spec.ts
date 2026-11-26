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
