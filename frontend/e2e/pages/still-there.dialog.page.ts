import type { Page } from '@playwright/test';

export class StillThereDialogPage {
  constructor(private readonly page: Page) {}

  readonly dialog = () => this.page.getByRole('dialog', { name: 'Still there?' });

  async continue(): Promise<void> {
    await this.dialog().getByRole('button', { name: 'Continue', exact: true }).click();
  }

  async stop(): Promise<void> {
    await this.dialog().getByRole('button', { name: 'Stop', exact: true }).click();
  }
}
