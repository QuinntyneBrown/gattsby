import type { Page } from '@playwright/test';

export class PhotoReadDialogPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog', {
      name: /Read the model plate|Frame the model plate|Check what I read|Type the model instead|Reading the photo/,
    });
  }

  get maker() {
    return this.dialog.getByRole('textbox', { name: 'Maker', exact: true });
  }

  get model() {
    return this.dialog.getByRole('textbox', { name: 'Model', exact: true });
  }

  get serial() {
    return this.dialog.getByRole('textbox', { name: 'Serial number (optional)', exact: true });
  }

  get useThis() {
    return this.dialog.getByRole('button', { name: 'Use this', exact: true });
  }

  get openCamera() {
    return this.dialog.getByRole('button', { name: 'Open camera' });
  }

  get takePhoto() {
    return this.dialog.getByRole('button', { name: 'Take photo' });
  }

  get picker() {
    return this.dialog.locator('input[type="file"]');
  }
}
