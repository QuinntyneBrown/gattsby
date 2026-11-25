import type { Locator, Page } from '@playwright/test';

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
  }

  title(): Promise<string> {
    return this.page.title();
  }

  async identify(): Promise<void> {
    await this.identifyADevice.click();
  }
}
