// Requirements: NFR-023, NFR-012
// The shared fixture fails a spec on each forbidden event (simulate-devices-and-model design,
// "Guards"). Each spec below makes the page misbehave once, checks that the guard recorded it,
// and acknowledges it, so the guard's teardown only fails on what nobody expected.

import { expect, test } from './fixtures/gattsby-test';
import { Misbehaviour } from './fixtures/misbehaviour';
import { HomePage } from './pages/home.page';
import { treadmill } from './fixtures/scripted-ids';

test.describe('Guards', () => {
  test.describe('with no chooser script', () => {
    test('Given no chooser script, when the page asks for a device, then the unexpected-Bluetooth guard records it', async ({
      page,
      guards,
    }) => {
      await new HomePage(page).goto();

      await new Misbehaviour(page).requestAnyDevice();

      await expect.poll(() => guards.kinds()).toContain('unexpected-bluetooth');
      guards.acknowledge('unexpected-bluetooth');
    });
  });

  test.describe('with the FTMS treadmill picked in the chooser', () => {
    test.use({ bluetooth: { devices: [treadmill.id], chooser: [{ pick: treadmill.id }] } });

    test('Given no approval, when the page writes to the control point, then the unapproved-write guard records it', async ({
      page,
      guards,
    }) => {
      await new HomePage(page).goto();

      await new Misbehaviour(page).writeToCharacteristic(
        treadmill.ftmsService,
        treadmill.controlPoint,
        [0x00],
      );

      await expect.poll(() => guards.kinds()).toContain('unapproved-write');
      guards.acknowledge('unapproved-write');
    });

    test('Given an approval for those bytes, when the page writes them, then the write is recorded and no guard trips', async ({
      page,
      approvals,
      fakeBluetooth,
    }) => {
      await new HomePage(page).goto();
      approvals.record(treadmill.controlPoint, [0x00]);

      const indication = await new Misbehaviour(page).writeToCharacteristic(
        treadmill.ftmsService,
        treadmill.controlPoint,
        [0x00],
      );

      expect(indication).toEqual([0x80, 0x00, 0x01]);
      await expect
        .poll(() => fakeBluetooth.writes())
        .toEqual([
          expect.objectContaining({ characteristic: treadmill.controlPoint, bytes: [0x00] }),
        ]);
    });

    test('Given the person walks faster, when the treadmill notifies, then the speed field rises', async ({
      page,
      fakeBluetooth,
    }) => {
      await new HomePage(page).goto();
      const misbehaviour = new Misbehaviour(page);
      await misbehaviour.subscribe(treadmill.ftmsService, treadmill.treadmillData);

      await fakeBluetooth.setEffort(1);
      await page.clock.runFor(1000);
      const walking = await misbehaviour.lastNotification();
      await fakeBluetooth.setEffort(2);
      await page.clock.runFor(1000);
      const faster = await misbehaviour.lastNotification();

      // Treadmill Data: flags 0x040C, then the instantaneous speed in 0.01 km/h.
      expect(walking.slice(0, 4)).toEqual([0x0c, 0x04, 0x2c, 0x01]); // 3.00 km/h
      expect(faster.slice(0, 4)).toEqual([0x0c, 0x04, 0x58, 0x02]); // 6.00 km/h
    });
  });

  test.describe('with a model and no scripted responses', () => {
    test.use({ model: { availability: 'available', responses: [] } });

    test('Given no scripted response, when the page prompts the model, then the unexpected-model guard records it', async ({
      page,
      guards,
      fakeModel,
    }) => {
      await new HomePage(page).goto();

      await new Misbehaviour(page).promptModel('Which tool next?');

      await expect.poll(() => guards.kinds()).toContain('unexpected-model');
      guards.acknowledge('unexpected-model');
      expect(await fakeModel.prompts()).toEqual(['Which tool next?']);
    });
  });

  test.describe('with one scripted model response', () => {
    test.use({
      model: {
        availability: 'available',
        responses: [{ action: { action: 'call_tool', tool: 'check_capabilities', input: {} } }],
      },
    });

    test('Given a scripted action, when the page prompts the model, then the model returns it and no guard trips', async ({
      page,
    }) => {
      await new HomePage(page).goto();

      const answer = await new Misbehaviour(page).promptModel('Which tool next?');

      expect(JSON.parse(answer)).toEqual({
        action: 'call_tool',
        tool: 'check_capabilities',
        input: {},
      });
    });
  });

  test('Given the app, when a request leaves localhost, then the network guard records it', async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    await new Misbehaviour(page).openOffLocalhost();

    expect(guards.kinds()).toContain('request-off-localhost');
    guards.acknowledge('request-off-localhost');
  });

  test('Given the app, when an error goes uncaught, then the page-error guard records it', async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    await new Misbehaviour(page).throwUncaught();

    await expect.poll(() => guards.kinds()).toContain('page-error');
    guards.acknowledge('page-error');
  });

  test('Given the app, when the page asks for the location, then the geolocation guard records it', async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    await new Misbehaviour(page).askForLocation();

    await expect.poll(() => guards.kinds()).toContain('geolocation');
    guards.acknowledge('geolocation');
  });

  test('Given the app, when the page opens a dialog, then the guard dismisses and records it', async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    await new Misbehaviour(page).openAlert();

    expect(guards.kinds()).toContain('dialog');
    guards.acknowledge('dialog');
  });

  test('Given a violation nobody acknowledged, when the spec ends, then the guard fails it', async ({
    page,
  }) => {
    test.fail(true, 'The guard must fail this spec at teardown.');
    await new HomePage(page).goto();

    await new Misbehaviour(page).throwUncaught();
    await page.evaluate(() => 0);
  });
});
