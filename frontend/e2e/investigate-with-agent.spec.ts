// Traces to: FR-005, FR-041, FR-042, FR-044, FR-046, FR-048, FR-071, NFR-001, NFR-020
// Given a model is available, when the person turns off full agent mode in Settings,
// then the choice survives reload and the next investigation starts as a checklist.

import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { SettingsPage } from './pages/settings.page';
import { VerdictPage } from './pages/verdict.page';

test('uses the saved choice to start without calling the model', async ({ page, fakeModel }) => {
  const home = new HomePage(page);
  const settings = new SettingsPage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.settings.click({ timeout: 3_000 });
  await expect(settings.useAgent).toBeChecked();
  await settings.useAgent.uncheck();
  await expect(settings.useAgent).toBeEnabled();
  await page.reload();
  await expect(settings.useAgent).not.toBeChecked();
  const before = fakeModel.calls().length;
  await settings.back.click();
  await expect(home.modeChip).toHaveText('Checklist mode');
  await home.identify();
  await investigation.waitForPrompt('What kind of machine is it?');
  await expect(investigation.subtitle).toHaveText('Checklist · Prepare');
  expect(await new StoredRecords(page).investigation(investigation.id())).toMatchObject({
    mode: 'checklist',
  });
  expect(fakeModel.calls()).toHaveLength(before);
});

test('opens one agent session before Prepare and releases it when leaving', async ({
  page,
  fakeModel,
}) => {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.waitForPrompt('What kind of machine is it?');
  await expect(investigation.subtitle).toHaveText('Agent · Prepare');
  expect(fakeModel.calls().filter((method) => method === 'create')).toHaveLength(1);
  expect(fakeModel.prompts()).toEqual([]);
  await investigation.leave.click();
  await expect.poll(() => fakeModel.calls()).toContain('destroy');
});

test.describe('The model refuses a session', () => {
  test.use({
    model: { availability: 'available', createError: 'NotSupportedError', responses: [] },
  });
  test('starts in checklist mode when Chrome cannot create the session', async ({
    page,
    fakeModel,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.waitForPrompt('What kind of machine is it?');
    await expect(investigation.subtitle).toHaveText('Checklist · Prepare');
    expect(fakeModel.calls().filter((method) => method === 'create')).toHaveLength(1);
    expect(fakeModel.prompts()).toEqual([]);
  });
});

test.describe('Two plausible protocols on the FTMS treadmill', () => {
  test.use({
    bluetooth: {
      devices: [devices.treadmill.id],
      chooser: [{ pick: devices.treadmill.id }],
      permittedServices: [0xfff0],
      omitCharacteristics: [0x2ad9],
    },
    model: {
      availability: 'available',
      responses: [
        {
          action: {
            type: 'call_tool',
            tool: 'update_hypothesis',
            input: { protocol: 'FTMS', proposedConfidence: 1, evidence: ['s-7'] },
            why: 'Treadmill Data is a stronger fit for this machine.',
          },
        },
      ],
    },
  });

  test('consults the model once at the ambiguous step and confirms FTMS @critical', async ({
    page,
    fakeBluetooth,
    fakeModel,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.prepare('Treadmill', 'Don’t know');
    expect(fakeModel.prompts()).toEqual([]);
    await investigation.choose('Find the device');
    await expect.poll(() => fakeModel.prompts().length, { timeout: 3_000 }).toBe(1);
    const [prompt] = fakeModel.prompts();
    expect(prompt).toContain('FTMS');
    expect(prompt).toContain('0000fff0');
    expect(prompt).not.toMatch(/(?:\b[0-9a-f]{2}\s+){5}/i);
    await expect(investigation.feed).toContainText(
      'Treadmill Data is a stronger fit for this machine.',
    );
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
    const id = investigation.id();
    const records = new StoredRecords(page);
    expect(await records.investigation(id)).toMatchObject({ mode: 'agent', modelConsultations: 1 });
    expect(await records.steps(id)).toContainEqual(
      expect.objectContaining({ tool: 'update_hypothesis', decidedBy: 'model' }),
    );
    expect(fakeModel.prompts()).toHaveLength(1);
    expect(fakeBluetooth.writes()).toEqual([]);
    expect(await page.evaluate(() => performance.now())).toBeLessThan(180_000);
  });
});
