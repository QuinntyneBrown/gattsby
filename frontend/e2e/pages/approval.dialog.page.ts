import { expect, type Page } from '@playwright/test';
import type { Approvals } from '../fixtures/approvals';

export class ApprovalDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Approve a command' });
  }

  get send() {
    return this.dialog.getByRole('button', { name: 'Send', exact: true });
  }

  get dontSend() {
    return this.dialog.getByRole('button', { name: 'Don’t send' });
  }

  get standClear() {
    return this.dialog.getByRole('checkbox', { name: 'I am clear and know where the stop is' });
  }

  async approve(approvals: Approvals, characteristic: string, bytes: readonly number[]) {
    await expect(this.send).toBeEnabled();
    approvals.record(characteristic, bytes);
    await this.send.click();
  }
}
