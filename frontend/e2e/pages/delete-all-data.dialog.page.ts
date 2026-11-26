import type { Page } from '@playwright/test';

export class DeleteAllDataDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', { name: 'Delete all data?', exact: true });
  }

  get cancel() {
    return this.dialog.getByRole('button', { name: 'Cancel', exact: true });
  }

  get confirmation() {
    return this.dialog.getByRole('textbox', { name: 'Type DELETE in capitals to confirm.' });
  }

  get confirm() {
    return this.dialog.getByRole('button', { name: 'Delete all data', exact: true });
  }
}
