import type { Page } from '@playwright/test';

export class AddNoteDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Add to this investigation' });
  }

  get location() {
    return this.dialog.getByRole('textbox', { name: /^Location/ });
  }

  get note() {
    return this.dialog.getByRole('textbox', { name: 'Note' });
  }

  get error() {
    return this.dialog.getByRole('alert');
  }

  get save() {
    return this.dialog.getByRole('button', { name: 'Save' });
  }

  get emergencyStop() {
    return this.dialog.getByRole('button', { name: 'Emergency stop' });
  }
}
