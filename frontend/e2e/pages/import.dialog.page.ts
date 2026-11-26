import type { Page } from '@playwright/test';

export class ImportDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Import', exact: true });
  }

  get picker() {
    return this.dialog.locator('input[type="file"]');
  }

  get openProfile() {
    return this.dialog.getByRole('button', { name: 'Open the profile', exact: true });
  }

  get message() {
    return this.dialog.getByRole('status').or(this.dialog.getByRole('alert'));
  }
}
