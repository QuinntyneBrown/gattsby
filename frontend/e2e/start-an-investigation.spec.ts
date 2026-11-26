// Acceptance Test
// Traces to: FR-007, FR-008, FR-050, FR-052, FR-060, NFR-009, NFR-016, TOOL-001, TOOL-025
// Description: Start an investigation from the Home page and answer the Prepare questions

import { expect, test } from './fixtures/gattsby-test';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';

test.describe('Start an investigation', () => {
  test('Given a first visit, when the Home page opens, then it offers "Identify a device" and asks for no permission', async ({
    page,
    fakeBluetooth,
  }) => {
    const home = new HomePage(page);

    await home.goto();

    await expect(home.heading).toHaveText('Stand next to a machine. Let’s find out how it talks.');
    await expect(home.identifyADevice).toBeVisible();
    expect(fakeBluetooth.calls()).not.toContain('requestDevice');
  });

  test('Given the capability check passes, when the person taps "Identify a device", then the investigation is stored and Prepare asks the machine type', async ({
    page,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    const records = new StoredRecords(page);
    await home.goto();

    await home.identify();

    await investigation.waitForPrompt('What kind of machine is it?');
    expect(await investigation.currentStage()).toBe('Prepare');
    await expect(investigation.subtitle).toHaveText('Agent · Prepare');
    await expect(investigation.promptEyebrow).toHaveText('Question 1 of 3');
    for (const answer of [
      'Treadmill',
      'Bike',
      'Rower',
      'Cross-trainer',
      'Heart-rate sensor',
      'Other',
      'Don’t know',
    ]) {
      await expect(investigation.answer(answer)).toBeVisible();
    }
    const stored = await records.investigation(investigation.id());
    expect(stored).toMatchObject({
      mode: 'agent',
      appVersion: '0.1.0',
      kbVersion: '2026.11.1',
      status: 'running',
    });
    expect(stored?.startedAt).toBeGreaterThan(0);
  });

  test('Given a phone held at arm’s length, when the machine type is asked, then each answer is at least 48 px and the first lies in the bottom third', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();

    await home.identify();
    await investigation.waitForPrompt('What kind of machine is it?');

    const title = await investigation.promptTitle.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    );
    expect(title).toBeGreaterThanOrEqual(20);
    for (const answer of ['Treadmill', 'Don’t know']) {
      const box = await investigation.answer(answer).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
      expect(box?.width).toBeGreaterThanOrEqual(48);
    }
    const first = await investigation.answer('Treadmill').boundingBox();
    expect(first!.y).toBeGreaterThanOrEqual((844 * 2) / 3);
  });

  test('Given the machine type and brand answered "Don’t know", when Prepare ends, then the person is asked to switch it on and Find follows', async ({
    page,
    fakeModel,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    const records = new StoredRecords(page);
    await home.goto();
    await home.identify();

    await investigation.prepare('Don’t know', 'Don’t know');

    await investigation.waitForPrompt('Find the device');
    expect(await investigation.currentStage()).toBe('Find');
    await expect(investigation.stageState('Prepare')).toHaveText('Prepare: done');
    const steps = await records.steps(investigation.id());
    expect(steps.map((step) => step.tool)).toEqual([
      'check_capabilities',
      'ask_user',
      'ask_user',
      'request_action',
    ]);
    expect(fakeModel.prompts()).toEqual([]);
  });

  test('Given the brand question, when the person types the brand, then the answer is stored as text and shown in the feed', async ({
    page,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.waitForPrompt('What kind of machine is it?');
    await investigation.choose('Treadmill');
    await investigation.waitForPrompt('Is there a brand on it?');

    await investigation.typeAnswer('<b>Horizon</b>, on the console');

    await expect(investigation.promptTitle).toHaveText(/Switch it on/);
    await expect(investigation.feed.getByText('<b>Horizon</b>, on the console')).toBeVisible();
  });

  test('Given the brand question, when the person skips it, then the skip is recorded and Prepare continues', async ({
    page,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.waitForPrompt('What kind of machine is it?');
    await investigation.choose('Bike');
    await investigation.waitForPrompt('Is there a brand on it?');

    await investigation.choose('Skip');

    await expect(investigation.promptTitle).toHaveText(/Switch it on/);
    await expect(investigation.feed.getByText('Skipped')).toBeVisible();
  });

  test('Given two steps were committed, when the page is reloaded, then the investigation shows the steps so far', async ({
    page,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.waitForPrompt('What kind of machine is it?');
    await investigation.choose('Rower');
    await investigation.waitForPrompt('Is there a brand on it?');

    await page.reload();

    await expect(investigation.feed.getByText('Rower')).toBeVisible();
    await expect(investigation.feed.getByText('What kind of machine is it?')).toBeVisible();
  });
});
