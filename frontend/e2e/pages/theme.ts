import type { Page } from '@playwright/test';

// Reads what the person sees of the theme and the fonts; shared by every page object's checks.
export class Theme {
  constructor(private readonly page: Page) {}

  canvasColour(): Promise<string> {
    return this.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  }

  async loadedFontFamilies(): Promise<string[]> {
    return this.page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((face) => face.status === 'loaded')
        .map((face) => face.family.replaceAll('"', ''));
    });
  }
}
