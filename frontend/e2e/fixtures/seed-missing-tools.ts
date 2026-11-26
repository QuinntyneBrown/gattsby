import type { Page } from '@playwright/test';
import type { Investigation } from '../../src/app/store/model/investigation';
import type { MissingToolRequest } from '../../src/app/store/model/missing-tool-request';

export async function seedMissingTools(page: Page, devices: readonly string[]): Promise<void> {
  await page.evaluate(
    (names) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open('gattsby');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result;
          const transaction = db.transaction(
            ['investigations', 'missingToolRequests'],
            'readwrite',
          );
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
          for (const [index, name] of names.entries()) {
            const startedAt = Date.UTC(2026, 10, 25 + index);
            const id = `i-00000000-0000-4000-8000-00000000000${index}`;
            const investigation: Investigation = {
              id,
              deviceName: name,
              mode: 'checklist',
              stage: 'conclude',
              status: 'concluded',
              appVersion: '0.1.0',
              kbVersion: '2026.11',
              recordFormat: 1,
              modelConsultations: 0,
              lastCommittedStep: 1,
              startedAt,
              interruptedAt: null,
              endedAt: startedAt + 1000,
              profileId: null,
              verdict: {
                kind: 'needsMissingTool',
                label: 'Needs a missing tool',
                protocol: null,
                summary: 'The advertised data needs a decoder.',
                stopReason: 'finish',
                issuedAt: startedAt + 1000,
                stepN: 1,
                evidence: ['m-1'],
              },
            };
            const request: MissingToolRequest = {
              id: 'm-1',
              investigationId: id,
              capabilityKey: 'decode vendor x',
              title: 'Decode vendor X',
              reason: 'The recorded format needs a decoder.',
              createdAt: startedAt + 1000,
              stepN: 1,
              evidence: [],
              occurrences: index + 1,
              stages: ['proprietary'],
              sources: ['unsupported'],
            };
            transaction.objectStore('investigations').put(investigation);
            transaction.objectStore('missingToolRequests').put(request);
          }
        };
      }),
    [...devices],
  );
}
