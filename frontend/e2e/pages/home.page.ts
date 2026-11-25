import type { Locator, Page } from '@playwright/test';

// The Home page at `/` (docs/mocks/pages/home/default.html). Journey 1 draws only the app shell
// around it: the skip link and the app bar with the brand.
export class HomePage {
  readonly brand: Locator;
  readonly skipLink: Locator;
  readonly main: Locator;

  constructor(private readonly page: Page) {
    this.brand = page.getByRole('link', { name: 'Gattsby, home' });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
    this.main = page.getByRole('main');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  title(): Promise<string> {
    return this.page.title();
  }
}
