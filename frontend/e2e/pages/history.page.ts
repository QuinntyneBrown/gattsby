import type { Locator, Page } from '@playwright/test';

export class HistoryPage {
  constructor(private readonly page: Page) {}

  get title(): Locator {
    return this.page.getByRole('heading', { name: 'Past investigations', exact: true });
  }

  get investigationLinks(): Locator {
    return this.page.getByRole('list', { name: 'Past investigations' }).getByRole('link');
  }

  get storage(): Locator {
    return this.page.getByRole('region', { name: 'Storage' });
  }
}
