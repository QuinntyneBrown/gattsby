// Traces to: FR-005, FR-006, FR-043, FR-045, FR-049, FR-051
// Given no model is available, when an investigation starts, then the checklist explains
// the operating mode before asking the person to take the first step.

import { expect, test } from './fixtures/gattsby-test';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';

test.describe('The browser has no on-device model', () => {
  test.use({ model: { availability: 'absent', responses: [] } });

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
    expect(fakeModel.calls()).toEqual([]);
  });
});
