import type { Page } from '@playwright/test';
import type { DecodedMetric } from '../../src/app/knowledge-base/decoders/decoded-metric';
import type { MissingToolRequest } from '../../src/app/store/model/missing-tool-request';
import type { InvestigationPhoto } from '../../src/app/store/model/investigation-photo';

// Reads what Gattsby committed to IndexedDB, as a spec's evidence that a step was saved (FR-007,
// FR-060). It opens the database read-only from the page and never writes to it.
export interface StoredInvestigation {
  readonly id: string;
  readonly startedAt: number;
  readonly mode: string;
  readonly appVersion: string;
  readonly kbVersion: string;
  readonly stage: string;
  readonly status: string;
  readonly lastCommittedStep: number;
  readonly modelConsultations?: number;
  readonly verdict?: { readonly kind: string; readonly label: string } | null;
}

export interface StoredStep {
  readonly n: number;
  readonly id: string;
  readonly stage: string;
  readonly tool: string;
  readonly status: string;
  readonly decidedBy?: string;
  readonly mode?: string;
  readonly result: {
    readonly ok: boolean;
    readonly data: unknown;
    readonly error?: { readonly code: string; readonly message: string } | null;
  };
}

export interface StoredObservation {
  readonly investigationId: string;
  readonly kind: string;
  readonly subject: string;
  readonly value: string;
  readonly evidence: readonly string[];
}

export interface StoredRecording {
  readonly investigationId: string;
  readonly id: string;
  readonly label: string;
  readonly level?: number;
  readonly characteristics: readonly string[];
  readonly seconds: number;
  readonly valueCount: number;
  readonly interrupted: boolean;
}

export class StoredRecords {
  constructor(private readonly page: Page) {}

  rawCount(investigationId: string): Promise<number> {
    return this.page.evaluate(
      (id) =>
        new Promise<number>((resolve, reject) => {
          const open = indexedDB.open('gattsby');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
            const count = db.transaction('rawLog').objectStore('rawLog').count(range);
            count.onsuccess = () => {
              db.close();
              resolve(count.result);
            };
            count.onerror = () => {
              db.close();
              reject(count.error);
            };
          };
        }),
      investigationId,
    );
  }

  investigations(): Promise<StoredInvestigation[]> {
    return this.readAll<StoredInvestigation>('investigations');
  }

  profiles(): Promise<unknown[]> {
    return this.readAll<unknown>('profiles');
  }

  async photoCount(id: string): Promise<number> {
    return (await this.photos(id)).length;
  }

  async photos(id: string): Promise<InvestigationPhoto[]> {
    const photos = await this.readAll<InvestigationPhoto>('photos');
    return photos.filter(({ investigationId }) => investigationId === id);
  }

  async databasePresent(): Promise<boolean> {
    return this.page.evaluate(async () =>
      (await indexedDB.databases()).some(({ name }) => name === 'gattsby'),
    );
  }

  async capabilityDiagnostics(): Promise<unknown[]> {
    const settings = await this.readAll<{ key: string; value: unknown[] }>('settings');
    return settings.find(({ key }) => key === 'capabilityDiagnostics')?.value ?? [];
  }

  async investigation(id: string): Promise<StoredInvestigation | undefined> {
    return (await this.investigations()).find((investigation) => investigation.id === id);
  }

  async steps(id: string): Promise<StoredStep[]> {
    const rows = await this.readAll<StoredStep & { investigationId: string }>('steps');
    return rows.filter((row) => row.investigationId === id);
  }

  async observations(id: string): Promise<StoredObservation[]> {
    const rows = await this.readAll<StoredObservation>('observations');
    return rows.filter((row) => row.investigationId === id);
  }

  async recordings(id: string): Promise<StoredRecording[]> {
    const rows = await this.readAll<StoredRecording>('recordings');
    return rows.filter((row) => row.investigationId === id);
  }

  async missingToolRequests(id: string): Promise<MissingToolRequest[]> {
    const rows = await this.readAll<MissingToolRequest>('missingToolRequests');
    return rows.filter((row) => row.investigationId === id);
  }

  async rawLog(id: string) {
    const rows = await this.readAll<{
      id: string;
      investigationId: string;
      kind: string;
      t: number;
      uuid?: string;
      hex: string;
      detail?: string;
      decoded?: readonly DecodedMetric[];
      decodeError?: string;
      approvalId?: string;
      recordingId?: string;
    }>('rawLog');
    return rows.filter((row) => row.investigationId === id);
  }

  private readAll<T>(store: string): Promise<T[]> {
    return this.page.evaluate(
      (name) =>
        new Promise<T[]>((resolve, reject) => {
          const open = indexedDB.open('gattsby');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains(name)) {
              db.close();
              resolve([]);
              return;
            }
            const request = db.transaction(name, 'readonly').objectStore(name).getAll();
            request.onsuccess = () => {
              db.close();
              resolve(request.result as T[]);
            };
            request.onerror = () => reject(request.error);
          };
        }),
      store,
    );
  }
}
