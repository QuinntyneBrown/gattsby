// Traces to: NFR-012
import { expect, test } from './fixtures/gattsby-test';
import { HomePage } from './pages/home.page';
import { SettingsPage } from './pages/settings.page';

// Given Settings, the person can see that data stays local and export is voluntary.
test('explains local data and export in Settings', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();
  await home.settings.click();
  await expect(new SettingsPage(page).about).toContainText(
    'Exporting is the only way data leaves, and only when you start it.',
    { timeout: 4_000 },
  );
});
