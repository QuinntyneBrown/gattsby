import type { Page } from '@playwright/test';

export class StopInvestigationDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Stop this investigation?' });
  }

  async choose(name: 'Keep going' | 'Stop and get a verdict') {
    await this.dialog.getByRole('button', { name, exact: true }).click();
  }
}
