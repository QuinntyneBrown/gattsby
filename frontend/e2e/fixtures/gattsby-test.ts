import { test as base, expect } from '@playwright/test';
import type { BluetoothScript, ModelScript } from '../../src/simulation/simulation-config';
import { Approvals } from './approvals';
import { FakeBluetooth, installFakes } from './fake-bluetooth';
import { FakeModel } from './fake-language-model';
import { Guards } from './guards';
import { SimulationRecorder } from './simulation-recorder';

interface GattsbyOptions {
  /** The scripted devices nearby and what Chrome's chooser does. */
  bluetooth: BluetoothScript;
  /** The model's availability and its scripted responses; 'absent' for checklist mode. */
  model: ModelScript;
}

interface GattsbyFixtures {
  recorder: SimulationRecorder;
  fakeBluetooth: FakeBluetooth;
  fakeModel: FakeModel;
  approvals: Approvals;
  guards: Guards;
}

// Playwright's `test` with both fakes, a fake clock and the guards (simulate-devices-and-model
// design). Every behaviour spec imports `test` and `expect` from here.
export const test = base.extend<GattsbyOptions & GattsbyFixtures>({
  bluetooth: [{ devices: [], chooser: [] }, { option: true }],
  model: [{ availability: 'available', responses: [] }, { option: true }],

  // eslint-disable-next-line no-empty-pattern
  recorder: async ({}, use) => {
    await use(new SimulationRecorder());
  },

  page: async ({ page, context, baseURL, bluetooth, model, recorder }, use) => {
    const origin = new URL(baseURL!).origin;
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === origin) {
        await route.continue();
        return;
      }
      recorder.violation('request-off-localhost', url.href);
      await route.abort('blockedbyclient');
    });
    page.on('pageerror', (error) => recorder.violation('page-error', error.message));
    // Angular's global error listeners call preventDefault() on uncaught errors and unhandled
    // rejections and log them with console.error, so `pageerror` never sees them in the app.
    page.on('console', (message) => {
      if (message.type() === 'error') recorder.violation('page-error', message.text());
    });
    page.on('dialog', async (dialog) => {
      recorder.violation('dialog', `${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });
    await installFakes(page, { bluetooth, model }, recorder);
    await page.clock.install();
    await use(page);
  },

  fakeBluetooth: async ({ page, recorder }, use) => {
    await use(new FakeBluetooth(page, recorder));
  },

  fakeModel: async ({ recorder }, use) => {
    await use(new FakeModel(recorder));
  },

  approvals: async ({ recorder }, use) => {
    await use(new Approvals(recorder));
  },

  guards: [
    async ({ page, recorder }, use) => {
      const guards = new Guards(recorder);
      await use(guards);
      // Let reports the page sent just before the end arrive.
      await page.evaluate(() => 0).catch(() => undefined);
      guards.verify();
    },
    { auto: true },
  ],
});

export { expect };
