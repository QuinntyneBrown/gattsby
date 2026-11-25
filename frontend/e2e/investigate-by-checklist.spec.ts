// Traces to: FR-005, FR-006, FR-043, FR-045, FR-049, FR-051
// Given no model is available, when an investigation starts, then the checklist explains
// the operating mode before asking the person to take the first step.

import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { AddNoteDialogPage } from './pages/add-note.dialog.page';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StillThereDialogPage } from './pages/still-there.dialog.page';
import { VerdictPage } from './pages/verdict.page';

test.describe('The browser has no on-device model', () => {
  test.use({
    model: { availability: 'absent', responses: [] },
    bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
  });

  test('explains checklist mode from the start', async ({ page, fakeModel }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await expect(home.modeChip).toHaveText('Checklist mode');
    await home.identify();
    await investigation.waitForPrompt('What kind of machine is it?');
    await expect(investigation.subtitle).toHaveText('Checklist · Prepare');
    await expect(investigation.modeBanner).toContainText('Running as a checklist.');
    await expect(investigation.modeBanner).toContainText(
      'Gattsby runs it and explains the result.',
    );
    await investigation.dismissModeBanner.click();
    await expect(investigation.modeBanner).toHaveCount(0);
    await expect(investigation.subtitle).toHaveText('Checklist · Prepare');
    await investigation.addNote.click();
    await expect(new AddNoteDialogPage(page).dialog).toBeVisible();
    expect(fakeModel.calls()).toEqual([]);
  });

  test('following the recommended steps confirms FTMS without loading the model @critical', async ({
    page,
    fakeBluetooth,
    fakeModel,
  }) => {
    const scripts: Promise<string>[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'script' && response.ok())
        scripts.push(response.text());
    });
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.prepare('Treadmill', 'Don’t know');
    const id = investigation.id();
    await investigation.choose('Find the device');
    await investigation.waitForPrompt('Pick the next step');
    expect(fakeBluetooth.calls()).not.toContain('connect');
    await investigation.choose('Connect to the device');
    await investigation.choose('List exposed services');
    await expect(investigation.promptDetail).toContainText('Recommended: Read device information');
    await expect(investigation.answer('Match known profiles')).toBeVisible();
    await investigation.choose('Read device information');
    await investigation.choose('Match known profiles');
    await investigation.choose('Read supported ranges');
    await fakeBluetooth.setEffort(1);
    await investigation.choose('Ready');
    await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
    await page.clock.runFor(10_500);
    await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
    await fakeBluetooth.setEffort(2);
    await page.clock.runFor(2_100);
    await investigation.choose('Done');
    await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
    await investigation.choose('Skip');
    await investigation.choose('Skip — finish read-only');
    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Connected — FTMS');
    await expect(verdict.item('Can read', 'Speed')).toContainText('confirmed');
    await expect(verdict.item('Can read', 'Distance')).toContainText('confirmed');
    const steps = await new StoredRecords(page).steps(id);
    expect(steps).toContainEqual(
      expect.objectContaining({
        tool: 'read_device_info',
        decidedBy: 'checklist',
        mode: 'checklist',
      }),
    );
    expect(steps.every((step) => step.mode === 'checklist')).toBe(true);
    expect(fakeModel.calls()).toEqual([]);
    const usesModel = (await Promise.all(scripts)).some((script) =>
      /The model must return one valid JSON action|You choose the next step of a read-only device investigation/.test(
        script,
      ),
    );
    expect(usesModel).toBe(false);
    expect(fakeBluetooth.writes()).toEqual([]);
  });

  test('resumes the same checklist choice when the person answers Still there', async ({
    page,
    fakeBluetooth,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    const dialog = new StillThereDialogPage(page);
    await home.goto();
    await home.identify();
    await investigation.prepare('Treadmill', 'Don’t know');
    await investigation.choose('Find the device');
    await expect(investigation.answer('Connect to the device')).toBeVisible();
    await page.clock.runFor(120_100);
    await expect(dialog.dialog()).toBeVisible();
    await dialog.continue();
    await expect(investigation.answer('Connect to the device')).toBeVisible();
    expect(fakeBluetooth.calls()).not.toContain('connect');
    await investigation.choose('Connect to the device');
    await expect(investigation.answer('List exposed services')).toBeVisible();
  });
});
