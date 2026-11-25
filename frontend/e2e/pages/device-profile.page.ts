import type { Page } from '@playwright/test';

export class DeviceProfilePage {
  constructor(private readonly page: Page) {}

  get readableData() {
    return this.page.getByRole('table', { name: 'Readable metrics and how to decode them' });
  }

  get verdict() {
    return this.page.getByText('Connected — FTMS', { exact: true });
  }

  get error() {
    return this.page.getByRole('alert');
  }

  get exportButton() {
    return this.page.getByRole('button', { name: 'Export', exact: true });
  }

  get notes() {
    return this.page.getByRole('region', { name: 'Notes' });
  }

  open(id: string) {
    return this.page.goto(`/profiles/${id}`);
  }
}
