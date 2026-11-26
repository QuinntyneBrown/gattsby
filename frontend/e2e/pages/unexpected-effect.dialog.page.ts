import type { Page } from '@playwright/test';

export class UnexpectedEffectDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Unexpected response' });
  }

  get finishReadOnly() {
    return this.dialog.getByRole('button', { name: 'Finish read-only' });
  }

  get emergencyStop() {
    return this.dialog.getByRole('button', { name: 'Emergency stop' });
  }
}
