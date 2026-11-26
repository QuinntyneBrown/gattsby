import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { InvestigationPage } from '../pages/investigation.page';
import { VerdictPage } from '../pages/verdict.page';
import type { FakeBluetooth } from './fake-bluetooth';

export async function finishTreadmill(
  page: Page,
  bluetooth: FakeBluetooth,
  beforeRecording?: (investigation: InvestigationPage) => Promise<void>,
): Promise<string> {
  await page.clock.install();
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  await investigation.choose('Find the device');
  if (beforeRecording) {
    await investigation.waitForPrompt(
      'Step on, press Start and walk slowly — around 3 km/h. Tap Ready when you’re walking.',
    );
    await beforeRecording(investigation);
  }
  await bluetooth.setEffort(1);
  await investigation.choose('Ready');
  await expect.poll(() => bluetooth.calls()).toContain('startNotifications');
  await page.clock.runFor(11_000);
  await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
  await bluetooth.setEffort(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
  await bluetooth.setIncline(2);
  await page.clock.runFor(1_100);
  await investigation.choose('Done');
  await investigation.choose('Skip — finish read-only');
  await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
  return investigation.id();
}
