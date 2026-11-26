import type { Locator, Page } from '@playwright/test';

export class EvidencePage {
  readonly title: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { name: 'Evidence', exact: true });
  }

  entry(id: string): Locator {
    return this.page.locator('.ev-list').locator(`[id="${id}"]`);
  }

  timestamp(id: string): Locator {
    return this.entry(id).locator('time');
  }
}
