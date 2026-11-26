// Traces to: FR-054, FR-058, FR-059, NFR-013, TOOL-029
import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures/gattsby-test';
import { seedMissingTools } from './fixtures/seed-missing-tools';
import { HomePage } from './pages/home.page';
import { MissingToolsPage } from './pages/missing-tools.page';
import { VerdictPage } from './pages/verdict.page';

// Given three investigations that raised the same missing tool, the Home summary
// leads to one request group, three verdicts and a local versioned JSON export.
test('lists one capability across investigations and exports its evidence', async ({ page }) => {
  const deviceNames = ['Rower A', 'Rower B', 'Rower C'];
  const home = new HomePage(page);
  const missingTools = new MissingToolsPage(page);
  await home.goto();
  await seedMissingTools(page, deviceNames);
  await home.goto();
  await expect(home.missingTools).toContainText('1 open');
  await home.missingTools.click();
  await expect(missingTools.title).toBeVisible();
  const group = missingTools.group('Decode vendor X');
  await expect(group).toHaveCount(1);
  await expect(group).toContainText('Open · 3 devices');
  for (const name of deviceNames)
    await expect(missingTools.investigation('Decode vendor X', name)).toBeVisible();

  const download = page.waitForEvent('download');
  await missingTools.exportJson.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^missing-tools-\d{4}-\d{2}-\d{2}\.gattsby\.json$/);
  const payload = JSON.parse(await readFile((await file.path())!, 'utf-8'));
  expect(payload).toMatchObject({
    kind: 'gattsby.missing-tool-requests',
    formatVersion: '1.0',
    requests: [
      {
        capability: 'Decode vendor X',
        count: 3,
        investigations: deviceNames.map((deviceName) => ({ deviceName })),
      },
    ],
  });
  await missingTools.investigation('Decode vendor X', 'Rower B').click();
  const verdict = new VerdictPage(page);
  await expect(verdict.title).toHaveText('Needs a missing tool');
  await expect(verdict.missingToolRequests).toHaveText('Decode vendor X');
});
