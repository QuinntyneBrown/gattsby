import type { Page } from '@playwright/test';

export class SettingsPage {
  constructor(private readonly page: Page) {}

  get useAgent() {
    return this.page.getByRole('checkbox', { name: 'Use the agent when it’s available' });
  }

  get back() {
    return this.page.getByRole('link', { name: 'Back' });
  }

  get deleteAll() {
    return this.page.getByRole('button', { name: 'Delete all data', exact: true });
  }
}
