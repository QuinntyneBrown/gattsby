import type { Page } from '@playwright/test';

export class StillThereDialogPage {
  constructor(private readonly page: Page) {}

  readonly dialog = () => this.page.getByRole('dialog', { name: 'Still there?' });
  readonly paused = () => this.page.getByRole('dialog', { name: 'Paused', exact: true });

  async choosePaused(name: 'Resume' | 'Save and exit' | 'Stop and get a verdict'): Promise<void> {
    await this.paused().getByRole('button', { name, exact: true }).click();
  }

  async continue(): Promise<void> {
    await this.dialog().getByRole('button', { name: 'Continue', exact: true }).click();
  }

  async stop(): Promise<void> {
    await this.dialog().getByRole('button', { name: 'Stop', exact: true }).click();
  }
}
