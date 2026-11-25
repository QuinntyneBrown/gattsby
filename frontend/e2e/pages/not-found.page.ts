import type { Locator, Page } from '@playwright/test';

// The Not found page, shown for any address no route matches
// (docs/mocks/pages/not-found/default.html).
export class NotFoundPage {
  readonly heading: Locator;
  readonly explanation: Locator;
  readonly goToHome: Locator;
  readonly brand: Locator;
  readonly main: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'This investigation isn’t on this device',
    });
    this.explanation = page.getByText('It may have been deleted, or the link came from another');
    this.goToHome = page.getByRole('link', { name: 'Go to home' });
    this.brand = page.getByRole('link', { name: 'Gattsby, home' });
    this.main = page.getByRole('main');
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  title(): Promise<string> {
    return this.page.title();
  }
}
