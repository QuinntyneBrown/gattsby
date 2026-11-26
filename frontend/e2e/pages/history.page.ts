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

  get storageWarning(): Locator {
    return this.page.getByRole('status').filter({ hasText: 'Storage is nearly full' });
  }

  deleteInvestigation(name: string): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(`^Delete the investigation of ${name}`),
    });
  }
}
