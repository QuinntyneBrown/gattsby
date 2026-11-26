import type { Page } from '@playwright/test';

export class DeviceProfilePage {
  constructor(private readonly page: Page) {}

  get requiredHandshake() {
    return this.page.getByRole('region', { name: 'Required handshake', exact: true });
  }

  get readableData() {
    return this.page.getByRole('table', { name: 'Readable metrics and how to decode them' });
  }

  get verdict() {
    return this.page.getByText('Connected — FTMS', { exact: true });
  }

  get name() {
    return this.page.getByRole('heading', { level: 1 });
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
