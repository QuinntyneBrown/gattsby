import type { Locator, Page } from '@playwright/test';

// The Verdict page at `/investigations/:id/verdict` (docs/mocks/pages/verdict/*.html).
export class VerdictPage {
  readonly title: Locator;
  readonly meta: Locator;
  readonly summary: Locator;
  readonly protocol: Locator;
  readonly newInvestigation: Locator;
  readonly missingToolRequests: Locator;

  constructor(private readonly page: Page) {
    this.title = page.locator('.verdict__title');
    this.meta = page.locator('.verdict__meta');
    this.summary = page.locator('.verdict__summary');
    this.protocol = page.locator('.verdict__protocol dd');
    this.newInvestigation = page.getByRole('button', { name: 'New investigation' });
    this.missingToolRequests = page.locator('.tool-card__title');
  }

  group(name: string): Locator {
    return this.page.locator('.group').filter({ has: this.page.getByRole('heading', { name }) });
  }

  item(group: string, key: string): Locator {
    return this.group(group)
      .locator('li')
      .filter({ has: this.page.locator('.group__k', { hasText: key }) });
  }
}
