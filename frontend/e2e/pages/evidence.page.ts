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

  filter(label: 'All' | 'Sent' | 'Received' | 'You' | 'Agent'): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  get entries(): Locator {
    return this.page.getByRole('list', { name: 'Evidence entries' });
  }

  get showEverything(): Locator {
    return this.page.getByText('Show everything', { exact: true });
  }

  get noMatches(): Locator {
    return this.page.getByText('No matching entries', { exact: true });
  }
}
