import type { Locator, Page } from '@playwright/test';

export class SavedDevicesPage {
  constructor(private readonly page: Page) {}

  get title(): Locator {
    return this.page.getByRole('heading', { name: 'Saved devices', exact: true });
  }

  get importFile(): Locator {
    return this.page.getByRole('button', { name: 'Import', exact: true });
  }

  goto() {
    return this.page.goto('/profiles');
  }

  get search(): Locator {
    return this.page.getByRole('searchbox', { name: 'Search saved devices' });
  }

  get clearSearch(): Locator {
    return this.page.getByRole('button', { name: 'Clear search', exact: true });
  }

  get noResults(): Locator {
    return this.page.getByText(/Nothing saved matches/);
  }

  filter(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  profile(name: string): Locator {
    return this.page
      .getByRole('list', { name: 'Saved devices' })
      .getByRole('link', { name: new RegExp(name) });
  }
}
