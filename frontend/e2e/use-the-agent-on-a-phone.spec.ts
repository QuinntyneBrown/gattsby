// Traces to: FR-074, FR-004, FR-005, NFR-004, NFR-021
import { expect, test } from './fixtures/gattsby-test';
import { usePhoneModel } from './fixtures/phone-model';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { ReadinessPage } from './pages/readiness.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  model: { availability: 'absent', responses: [] },
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  bluetooth: {
    devices: [devices.treadmill.id],
    chooser: [{ pick: devices.treadmill.id }],
    permittedServices: [0xfff0],
    omitCharacteristics: [0x2ad9],
  },
});

// Given Android with WebGPU and no native model, the person sees the size before
// any weights transfer. Download and start, consult the fake worker, and reach an FTMS verdict.
test('downloads on tap and investigates using the phone model @critical', async ({
  page,
  baseURL,
  fakeBluetooth,
  fakeModel,
}) => {
  const phone = await usePhoneModel(page, baseURL!);
  const readiness = new ReadinessPage(page);
  await readiness.open();
  await expect(readiness.downloadDetails).toContainText('256 KB', { timeout: 4_000 });
  await expect(readiness.downloadDetails).toBeInViewport();
  expect(phone.downloads()).toBe(0);
  expect(phone.sessions()).toBe(0);
  await readiness.download.click();
  await expect(readiness.heading).toHaveText('Ready to investigate.');
  expect(phone.downloads()).toBe(1);
  expect(phone.sessions()).toBe(0);
  await page.reload();
  await expect(readiness.heading).toHaveText('Ready to investigate.');
  expect(phone.downloads()).toBe(1);
  await readiness.start.click();
  await new HomePage(page).identify();
  const investigation = new InvestigationPage(page);
  await expect(investigation.subtitle).toHaveText('Agent · Prepare');
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  await expect(investigation.feed).toContainText('The phone model found');
  await fakeBluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(11_000);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  await fakeBluetooth.setEffort(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
  await fakeBluetooth.setIncline(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  expect(await new StoredRecords(page).investigation(investigation.id())).toMatchObject({
    mode: 'agent',
    modelConsultations: 1,
  });
  expect(phone.sessions()).toBe(1);
  expect(fakeModel.calls()).toEqual([]);
  expect(fakeBluetooth.writes()).toEqual([]);
});

// Given WebGPU returns no adapter, Readiness offers the checklist without downloading.
test('uses checklist mode when WebGPU has no adapter', async ({ page, baseURL }) => {
  const phone = await usePhoneModel(page, baseURL!, { webGpu: false });
  const readiness = new ReadinessPage(page);
  await readiness.open();
  await expect(readiness.capability('On-device model')).toContainText('WebGPU unavailable', {
    timeout: 4_000,
  });
  await readiness.continueButton.click();
  await new HomePage(page).identify();
  await expect(new InvestigationPage(page).subtitle).toHaveText('Checklist · Prepare');
  expect(phone.downloads()).toBe(0);
  expect(phone.sessions()).toBe(0);
});

test('uses checklist mode with the disabled production manifest', async ({ page, baseURL }) => {
  const phone = await usePhoneModel(page, baseURL!, { configured: false });
  const readiness = new ReadinessPage(page);
  await readiness.open();
  await expect(readiness.heading).toHaveText('Ready, in checklist mode.');
  await readiness.continueButton.click();
  await new HomePage(page).identify();
  await expect(new InvestigationPage(page).subtitle).toHaveText('Checklist · Prepare');
  expect(phone.downloads()).toBe(0);
  expect(phone.sessions()).toBe(0);
});

// Given the tap begins a transfer, cancel returns to the offer while the response is pending.
test('cancels an active download and can start it again', async ({ page, baseURL }) => {
  let release: () => void = () => undefined;
  const waitForFirstDownload = new Promise<void>((resolve) => (release = resolve));
  const phone = await usePhoneModel(page, baseURL!, { waitForFirstDownload });
  const readiness = new ReadinessPage(page);
  await readiness.open();
  try {
    await readiness.download.click({ timeout: 4_000 });
    await expect.poll(phone.downloads).toBe(1);
    await readiness.cancelDownload.click();
    await expect(readiness.download).toBeEnabled();
  } finally {
    release();
  }
  await readiness.download.click();
  await expect(readiness.heading).toHaveText('Ready to investigate.');
  expect(phone.downloads()).toBe(2);
});

// Given the server returns an incomplete asset, retry downloads it again.
test('offers retry after an incomplete download', async ({ page, baseURL }) => {
  const phone = await usePhoneModel(page, baseURL!, { truncateFirst: true });
  const readiness = new ReadinessPage(page);
  await readiness.open();
  await readiness.download.click({ timeout: 4_000 });
  await expect(readiness.heading).toHaveText('The model download stopped.');
  await readiness.retryDownload.click();
  await expect(readiness.heading).toHaveText('Ready to investigate.');
  expect(phone.downloads()).toBe(2);
});
