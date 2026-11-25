// Traces to: FR-001, FR-002, FR-003, FR-004, NFR-016, NFR-021, NFR-025, NFR-026, TOOL-001
// Given a supported browser with Bluetooth and the model, when Gattsby opens,
// then Readiness lists the capabilities and Start opens Home without requesting any permission.

import { expect, test } from './fixtures/gattsby-test';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { ReadinessPage } from './pages/readiness.page';

test('checks readiness at app launch and continues to Home @critical', async ({
  page,
  fakeBluetooth,
  fakeModel,
}) => {
  const readiness = new ReadinessPage(page);
  await readiness.openFromAppLaunch();
  await expect(page).toHaveURL('/start');
  await expect(readiness.heading).toHaveText('Ready to investigate.');
  for (const name of ['Browser', 'Bluetooth', 'On-device model', 'Camera', 'Storage']) {
    await expect(readiness.capability(name)).toContainText('Available');
  }
  await expect(readiness.capability('Advertisement scanning')).toContainText('Not available');
  await expect(readiness.capability('Advertisement scanning')).toContainText(
    'Only in Chrome with experimental features turned on',
  );
  expect(fakeBluetooth.requestDeviceOptions()).toEqual([]);
  expect(fakeModel.calls()).not.toContain('create');
  await readiness.start.click();
  await expect(new HomePage(page).identifyADevice).toBeVisible();
  await expect(page).toHaveURL('/');
});

test.describe('Bluetooth is off', () => {
  test.use({ bluetooth: { available: false, devices: [], chooser: [] } });
  test('keeps Start disabled until Bluetooth is available on re-check', async ({
    page,
    fakeBluetooth,
  }) => {
    const readiness = new ReadinessPage(page);
    await readiness.open();
    await expect(readiness.heading).toHaveText('Bluetooth is off.');
    await expect(readiness.capability('Bluetooth')).toContainText('Turn on Bluetooth');
    await expect(readiness.start).toBeDisabled();
    await fakeBluetooth.setAvailable(true);
    await readiness.checkAgain.click();
    await expect(readiness.start).toBeEnabled();
    expect(fakeBluetooth.requestDeviceOptions()).toEqual([]);
  });
});

test.describe('Bluetooth permission is denied', () => {
  test.use({ bluetooth: { blocked: true, available: false, devices: [], chooser: [] } });
  test('explains where to allow Bluetooth and prompts for nothing', async ({
    page,
    fakeBluetooth,
  }) => {
    const readiness = new ReadinessPage(page);
    await readiness.open();
    await expect(readiness.heading).toHaveText('Chrome is blocking Bluetooth.');
    await expect(readiness.capability('Bluetooth')).toContainText('Allow Bluetooth for this site');
    await expect(readiness.start).toBeEnabled();
    expect(fakeBluetooth.requestDeviceOptions()).toEqual([]);
  });
});

test.describe('Web Bluetooth is absent', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    bluetooth: { absent: true, devices: [], chooser: [] },
  });
  test('explains the unsupported iPhone browser without offering to start', async ({
    page,
    fakeBluetooth,
  }) => {
    const readiness = new ReadinessPage(page);
    await readiness.open();
    await expect(readiness.heading).toHaveText('Gattsby can’t run on iPhone.');
    await expect(readiness.capability('Browser')).toContainText('Chrome on a laptop or Android');
    await expect(readiness.continueButton).toHaveCount(0);
    expect(fakeBluetooth.calls()).toEqual([]);
  });
});

test('explains an insecure context without probing Bluetooth', async ({ page, fakeBluetooth }) => {
  await page.addInitScript(() =>
    Object.defineProperty(globalThis, 'isSecureContext', { value: false }),
  );
  const readiness = new ReadinessPage(page);
  await readiness.open();
  await expect(readiness.heading).toHaveText('Bluetooth needs a secure address.');
  await expect(readiness.capability('Browser')).toContainText('HTTPS');
  await expect(readiness.continueButton).toHaveCount(0);
  expect(fakeBluetooth.calls()).toEqual([]);
});

test('asks for a re-check when storage cannot open', async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException('Test storage blocked', 'SecurityError');
    };
  });
  const readiness = new ReadinessPage(page);
  await readiness.open();
  await expect(readiness.heading).toHaveText('Gattsby can’t save on this device.');
  await expect(readiness.capability('Storage')).toContainText('Allow this site to save data');
  await expect(readiness.checkAgain).toBeVisible();
  await expect(readiness.continueButton).toHaveCount(0);
});

test.describe('The model can be downloaded', () => {
  test.use({ model: { availability: 'downloadable', responses: [] } });
  test('waits for a tap and updates progress as Chrome downloads the model', async ({
    page,
    fakeModel,
  }) => {
    const readiness = new ReadinessPage(page);
    await readiness.open();
    await expect(readiness.heading).toHaveText('Download the on-device model?');
    await page.clock.runFor(3_000);
    expect(fakeModel.calls()).not.toContain('create');
    await readiness.download.click();
    await expect(readiness.heading).toHaveText('Getting the on-device model ready.');
    await expect(readiness.progress).toHaveAttribute('value', '0');
    await page.clock.runFor(1_050);
    await expect(readiness.progress).toHaveAttribute('value', '50');
    await expect(readiness.continueButton).toBeEnabled();
    await page.clock.runFor(1_050);
    await expect(readiness.heading).toHaveText('Ready to investigate.');
    expect(fakeModel.calls().filter((method) => method === 'create')).toHaveLength(1);
    expect(fakeModel.calls()).toContain('destroy');
    expect(fakeModel.prompts()).toEqual([]);
  });
});

test.describe('The download fails once', () => {
  test.use({ model: { availability: 'downloadable', responses: [], downloadFailures: 1 } });
  test('keeps the percentage and lets the person retry or continue in checklist mode', async ({
    page,
  }) => {
    const readiness = new ReadinessPage(page);
    await readiness.open();
    await readiness.download.click();
    await expect(readiness.progress).toHaveAttribute('value', '0');
    await page.clock.runFor(1_100);
    await expect(readiness.heading).toHaveText('The model download stopped.');
    await expect(readiness.capability('On-device model')).toContainText('Download failed at 50%');
    await expect(readiness.continueButton).toBeEnabled();
    await readiness.retryDownload.click();
    await expect(readiness.progress).toHaveAttribute('value', '0');
    await page.clock.runFor(2_150);
    await expect(readiness.heading).toHaveText('Ready to investigate.');
  });
});

test.describe('The model is unavailable', () => {
  test.use({ model: { availability: 'absent', responses: [] } });
  test('explains the checklist and continues without the Prompt API', async ({
    page,
    fakeModel,
  }) => {
    const readiness = new ReadinessPage(page);
    await readiness.open();
    await expect(readiness.heading).toHaveText('Ready, in checklist mode.');
    await expect(readiness.capability('On-device model')).toContainText(
      'Not available on this device',
    );
    await readiness.continueButton.click();
    await expect(page).toHaveURL('/');
    await expect(new HomePage(page).modeChip).toHaveText('Checklist mode');
    expect(fakeModel.calls()).toEqual([]);
  });
});

test('finishes a stalled readiness check in a second and keeps the diagnostic local', async ({
  page,
  fakeModel,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => {
        throw new Error('Readiness must not request the camera.');
      },
    });
    let checks = 0;
    Object.defineProperty(navigator, 'bluetooth', {
      get: () => ({
        getAvailability: () =>
          checks++ === 0 ? Promise.resolve(false) : new Promise(() => undefined),
      }),
    });
  });
  const readiness = new ReadinessPage(page);
  await readiness.open();
  await expect(readiness.heading).toHaveText('Bluetooth is off.');
  await readiness.checkAgain.click();
  await expect(readiness.heading).toHaveText('Checking this device…');
  await expect(readiness.capability('Bluetooth')).toContainText('Checking');
  await page.clock.runFor(1_050);
  await expect(readiness.heading).not.toHaveText('Checking this device…');
  expect(fakeModel.calls()).not.toContain('create');
  await expect
    .poll(() => new StoredRecords(page).capabilityDiagnostics())
    .toEqual([
      expect.objectContaining({
        capability: 'bluetooth',
        code: 'CAPABILITY_TIMEOUT',
        tool: 'check_capabilities',
        stage: 'prepare',
        at: expect.any(Number),
      }),
    ]);
});
