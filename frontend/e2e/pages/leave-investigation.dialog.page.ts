import type { Page } from '@playwright/test';

export class LeaveInvestigationDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Leave the investigation?' });
  }

  async choose(name: 'Stay' | 'Leave and disconnect') {
    await this.dialog.getByRole('button', { name, exact: true }).click();
  }
}
