import type { Page } from '@playwright/test';

export class UpdateToastPage {
  constructor(private readonly page: Page) {}

  get offer() {
    return this.page.getByRole('status').filter({ hasText: 'A new version is ready' });
  }

  get reload() {
    return this.offer.getByRole('button', { name: 'Reload', exact: true });
  }
}
