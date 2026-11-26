import { expect, type Locator, type Page } from '@playwright/test';
import { ReadinessPage } from './readiness.page';

// The Home page at `/` (docs/mocks/pages/home/empty.html and default.html).
export class HomePage {
  readonly brand: Locator;
  readonly skipLink: Locator;
  readonly main: Locator;
  readonly heading: Locator;
  readonly identifyADevice: Locator;
  readonly modeChip: Locator;

  constructor(private readonly page: Page) {
    this.brand = page.getByRole('link', { name: 'Gattsby, home' });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
    this.main = page.getByRole('main');
    this.heading = page.getByRole('heading', { level: 1 });
    this.identifyADevice = page.getByRole('button', { name: 'Identify a device' });
    this.modeChip = page.locator('.mode-chip');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    const readiness = new ReadinessPage(this.page);
    await this.identifyADevice.or(readiness.continueButton).first().waitFor();
    if (await readiness.continueButton.isVisible()) {
      await readiness.continueButton.click();
      await expect(this.identifyADevice).toBeVisible();
    }
  }

  title(): Promise<string> {
    return this.page.title();
  }

  get settings() {
    return this.page.getByRole('link', { name: 'Settings' });
  }

  get missingTools(): Locator {
    return this.page.getByRole('link', { name: /Missing tools/ });
  }

  get pastInvestigations(): Locator {
    return this.page.getByRole('link', { name: /Past investigations/ });
  }

  resumeInvestigation(name: string) {
    return this.page.getByRole('link', { name: new RegExp(`^Resume: ${name}`) });
  }

  async identify(): Promise<void> {
    await this.identifyADevice.click();
  }
}
