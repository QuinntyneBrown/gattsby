import type { Page } from '@playwright/test';

export class ReadinessPage {
  constructor(private readonly page: Page) {}

  openFromAppLaunch() {
    return this.page.goto('/');
  }

  open() {
    return this.page.goto('/start');
  }

  get heading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get start() {
    return this.page.getByRole('button', { name: 'Start', exact: true });
  }

  get continueButton() {
    return this.page.getByRole('button', {
      name: /^(Start|Start in checklist mode|Start with the checklist)$/,
    });
  }

  get checkAgain() {
    return this.page.getByRole('button', { name: 'Check again' });
  }

  get download() {
    return this.page.getByRole('button', { name: 'Download the on-device model' });
  }

  get retryDownload() {
    return this.page.getByRole('button', { name: 'Retry the download' });
  }

  get progress() {
    return this.page.getByRole('progressbar', { name: 'Model download' });
  }

  capability(name: string) {
    return this.page
      .getByRole('listitem')
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }
}
