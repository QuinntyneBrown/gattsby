// Traces to: FR-005
// Given a model is available, when the person turns off full agent mode in Settings,
// then the choice survives reload and the next investigation starts as a checklist.

import { expect, test } from './fixtures/gattsby-test';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { SettingsPage } from './pages/settings.page';

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
