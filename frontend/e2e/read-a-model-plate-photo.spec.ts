// Traces to: FR-022, NFR-016, NFR-017, TOOL-027
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import { expect, test } from './fixtures/gattsby-test';
import { usePlateCamera } from './fixtures/plate-camera';
import { StoredRecords } from './fixtures/stored-records';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { PhotoReadDialogPage } from './pages/photo-read.dialog.page';

async function openPhotoStep(page: Page): Promise<InvestigationPage> {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.waitForPrompt('What kind of machine is it?');
  await investigation.chooseOption('Photo of the model plate or console');
  return investigation;
}

test.describe('Chrome has no on-device image model', () => {
  test.use({ model: { availability: 'absent', responses: [] } });

  // Given no image model, opening the photo step offers typing. Confirming saves
  // the chosen maker, model and serial as evidence without storing an attachment.
  test('records typed plate details only after Use this', async ({ page, fakeModel }) => {
    const investigation = await openPhotoStep(page);
    const plate = new PhotoReadDialogPage(page);
    await expect(plate.dialog).toHaveAccessibleName('Type the model instead');
    const records = new StoredRecords(page);
    const id = investigation.id();
    await plate.maker.fill('Fixture Fitness');
    await plate.serial.fill('FF-123');
    await plate.useThis.click();
    await expect(plate.dialog).toContainText('Enter the model');
    expect(await records.observations(id)).not.toContainEqual(
      expect.objectContaining({ kind: 'plate-read' }),
    );
    await plate.model.fill('T100');
    await plate.useThis.click();
    await expect(plate.dialog).toHaveCount(0);
    const observations = await records.observations(id);
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'plate-read',
          subject: 'manufacturer',
          value: 'Fixture Fitness',
        }),
        expect.objectContaining({ kind: 'plate-read', subject: 'model', value: 'T100' }),
        expect.objectContaining({ kind: 'plate-read', subject: 'serial', value: 'FF-123' }),
      ]),
    );
    expect(await records.photoCount(id)).toBe(0);
    expect(fakeModel.calls()).toEqual([]);
  });
});

test.describe('The on-device model can read images', () => {
  test.use({
    model: {
      availability: 'available',
      responses: [
        { action: { maker: 'Fixture Fitness', model: 'T100', serial: 'FF-123', confidence: 0.8 } },
      ],
    },
  });

  // Given a camera and image input, entry requests no permission. A person can
  // choose to open the camera, capture the plate, then correct the suggested model.
  test('reads a local camera frame and saves only the confirmed plate @critical', async ({
    page,
  }) => {
    const camera = await usePlateCamera(page);
    const investigation = await openPhotoStep(page);
    const id = investigation.id();
    const dialog = new PhotoReadDialogPage(page);
    const records = new StoredRecords(page);
    expect(await camera()).toEqual({ opened: 0, stopped: 0 });
    await dialog.openCamera.click({ timeout: 4_000 });
    await expect(dialog.dialog).toHaveAccessibleName('Frame the model plate');
    await dialog.takePhoto.click();
    await expect(dialog.model).toHaveValue('T100');
    expect(await camera()).toEqual({ opened: 1, stopped: 1 });
    expect(await records.photos(id)).toEqual([]);
    expect(await records.observations(id)).not.toContainEqual(
      expect.objectContaining({ kind: 'plate-read' }),
    );

    await dialog.model.fill('T102');
    await dialog.useThis.click();
    await expect(dialog.dialog).toHaveCount(0);
    const [photo] = await records.photos(id);
    expect(photo).toMatchObject({ mediaType: 'image/jpeg' });
    expect(await records.observations(id)).toContainEqual(
      expect.objectContaining({
        kind: 'plate-read',
        subject: 'model',
        value: 'T102',
        evidence: [photo.id],
      }),
    );
  });

  test('stores a selected JPEG without its camera or GPS EXIF tags', async ({ page }) => {
    const investigation = await openPhotoStep(page);
    const dialog = new PhotoReadDialogPage(page);
    await dialog.picker.setInputFiles(
      join(__dirname, 'fixtures', 'data', 'plate-with-location.jpg'),
      { timeout: 4_000 },
    );
    await expect(dialog.model).toHaveValue('T100');
    await dialog.useThis.click();
    await expect(dialog.dialog).toHaveCount(0);
    const [photo] = await new StoredRecords(page).photos(investigation.id());
    const saved = Buffer.from(photo.dataBase64, 'base64');
    expect(saved.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(saved.includes(Buffer.from('Exif\0\0'))).toBe(false);
    expect(saved.includes(Buffer.from('Synthetic test camera'))).toBe(false);
  });
});
