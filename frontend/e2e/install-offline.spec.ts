// Traces to: NFR-006, NFR-012
import { expect, test } from './fixtures/gattsby-test';
import { HomePage } from './pages/home.page';

// Given the production app, Chrome can read a same-origin manifest and load its
// standalone start page and required icons.
test('provides a standalone install manifest with usable icons', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();
  await expect(home.manifest).toHaveAttribute('href', /manifest\.webmanifest$/, { timeout: 4_000 });
  const install = await home.manifest.evaluate(async (element: HTMLLinkElement) => {
    const response = await fetch(element.href);
    const manifest = (await response.json()) as {
      name: string;
      display: string;
      start_url: string;
      icons: { src: string }[];
    };
    const icons = await Promise.all(
      manifest.icons.map(async ({ src }) => {
        const iconUrl = new URL(src, element.href);
        const icon = await fetch(iconUrl);
        const image = await createImageBitmap(await icon.blob());
        const size = image.width === image.height ? image.width : 0;
        image.close();
        return { sameOrigin: iconUrl.origin === location.origin, size };
      }),
    );
    return {
      name: manifest.name,
      display: manifest.display,
      start: new URL(manifest.start_url, element.href).href,
      icons,
    };
  });
  expect(install).toMatchObject({ name: 'Gattsby', display: 'standalone', start: page.url() });
  expect(install.icons).toEqual(
    expect.arrayContaining([
      { sameOrigin: true, size: 192 },
      { sameOrigin: true, size: 512 },
    ]),
  );
});
