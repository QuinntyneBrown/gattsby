import type { Page } from '@playwright/test';

export class ExportDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Export' });
  }

  get includeNotesAndPhotos() {
    return this.dialog.getByRole('checkbox', { name: /Include notes and photos/ });
  }

  get deviceProfile() {
    return this.dialog.getByRole('button', { name: /^Device profile/ });
  }

  get success() {
    return this.dialog.getByRole('status');
  }

  get done() {
    return this.dialog.getByRole('button', { name: 'Done' });
  }
}
