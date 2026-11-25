import type { Page } from '@playwright/test';

export class InvestigationOptionsDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Investigation options' });
  }

  get addNote() {
    return this.dialog.getByRole('button', { name: 'Add a note or the location' });
  }
}
