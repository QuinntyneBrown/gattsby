// Traces to: NFR-006
import { expect, test } from './fixtures/gattsby-test';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { StopInvestigationDialogPage } from './pages/stop-investigation.dialog.page';
import { UpdateToastPage } from './pages/update-toast.page';
import { VerdictPage } from './pages/verdict.page';

test.use({ serviceWorkers: 'allow' });

// Given a cached version is announced during an investigation, the current
// investigation reaches its verdict before the person is offered Reload.
test('offers a ready version only after the investigation, then reloads on request', async ({
  page,
}) => {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  const update = new UpdateToastPage(page);
  await home.goto();
  await home.identify();
  await investigation.waitForPrompt('What kind of machine is it?');

  let documentLoads = 0;
  page.on('load', () => documentLoads++);
  await page.evaluate(() =>
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'VERSION_READY',
          currentVersion: { hash: 'current-fixture' },
          latestVersion: { hash: 'latest-fixture' },
        },
      }),
    ),
  );
  await expect(update.offer).toHaveCount(0);
  await investigation.choose('Treadmill');
  await investigation.waitForPrompt('Is there a brand on it?');
  await expect(update.offer).toHaveCount(0);
  await investigation.chooseOption('Stop and get a verdict now');
  await new StopInvestigationDialogPage(page).choose('Stop and get a verdict');
  await expect(update.reload).toBeVisible({ timeout: 4_000 });
  expect(documentLoads).toBe(0);
  const reloaded = page.waitForEvent('load');
  await update.reload.click();
  await reloaded;
  expect(documentLoads).toBe(1);
  await expect(new VerdictPage(page).title).toHaveText('Stopped by the person');
});
