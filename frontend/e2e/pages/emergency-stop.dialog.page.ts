import type { Page } from '@playwright/test';

export class EmergencyStopDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Emergency stop' });
  }

  get stopped() {
    return this.dialog.getByRole('button', { name: 'The belt has stopped' });
  }
}
