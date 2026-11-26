import type { Page } from '@playwright/test';

export class DeleteInvestigationDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: /^Delete “/ });
  }

  get cancel() {
    return this.dialog.getByRole('button', { name: 'Cancel', exact: true });
  }

  get confirm() {
    return this.dialog.getByRole('button', { name: 'Delete investigation', exact: true });
  }
}
