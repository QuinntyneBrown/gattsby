import type { Locator, Page } from '@playwright/test';

export class MissingToolsPage {
  constructor(private readonly page: Page) {}

  get title(): Locator {
    return this.page.getByRole('heading', { name: 'Missing tools', exact: true });
  }

  get exportJson(): Locator {
    return this.page.getByRole('button', { name: 'Export JSON', exact: true });
  }

  group(title: string): Locator {
    return this.page.getByRole('listitem').filter({
      has: this.page.getByRole('heading', { name: title, exact: true }),
    });
  }

  investigation(title: string, deviceName: string): Locator {
    return this.group(title).getByRole('link', { name: deviceName, exact: true });
  }
}
