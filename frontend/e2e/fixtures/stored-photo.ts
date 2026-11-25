import type { Page } from '@playwright/test';

// The capture flow arrives in journey 19. Put a synthetic photo into the store to exercise export.
export const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+0XKQAAAAASUVORK5CYII=';

export async function seedStoredPhoto(page: Page, investigationId: string): Promise<void> {
  await page.evaluate(
    ({ investigationId, dataBase64 }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('gattsby');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('photos', 'readwrite');
          tx.objectStore('photos').put({
            investigationId,
            id: 'ph-fixture',
            takenAt: Date.now(),
            mediaType: 'image/png',
            dataBase64,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    { investigationId, dataBase64: tinyPng },
  );
}
