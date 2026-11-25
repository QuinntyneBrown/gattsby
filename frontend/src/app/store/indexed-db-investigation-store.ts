import { Injectable } from '@angular/core';
import { InvestigationStore } from './investigation-store';
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  investigationRange,
  OPEN_TIMEOUT_MS,
  upgrade,
} from './database-schema';
import type { Investigation, NewInvestigation } from './model/investigation';
import type { InvestigationRecord } from './model/investigation-record';
import type { RawLogEntry } from './model/raw-log-entry';
import type { StepCommit } from './model/step-commit';
import type { VerdictCommit } from './model/verdict-commit';
import { StoreError } from './store-error';

const RECORD_FORMAT = 1;

// The investigation store on IndexedDB (save-as-the-investigation-runs design). Every write
// resolves on the transaction's `complete` event, never on a request's `success`.
@Injectable()
export class IndexedDbInvestigationStore extends InvestigationStore {
  private database: Promise<IDBDatabase> | null = null;

  async create(init: NewInvestigation): Promise<Investigation> {
    const investigation: Investigation = {
      id: `i-${crypto.randomUUID()}`,
      startedAt: Date.now(),
      mode: init.mode,
      appVersion: init.appVersion,
      kbVersion: init.kbVersion,
      recordFormat: RECORD_FORMAT,
      stage: 'prepare',
      status: 'running',
      lastCommittedStep: 0,
      deviceName: null,
      endedAt: null,
      interruptedAt: null,
      verdict: null,
      profileId: null,
      modelConsultations: 0,
    };
    await this.write(['investigations'], 'strict', (tx) => {
      tx.objectStore('investigations').add(investigation);
    });
    return investigation;
  }

  async commitStep(commit: StepCommit): Promise<void> {
    const stores = [
      'investigations',
      'steps',
      'rawLog',
      'observations',
      'hypotheses',
      'missingToolRequests',
    ];
    await this.write(stores, 'strict', (tx) => {
      tx.objectStore('steps').put(commit.step);
      commit.rawLog.forEach((entry) => tx.objectStore('rawLog').put(entry));
      commit.observations.forEach((o) => tx.objectStore('observations').put(o));
      if (commit.hypothesis) tx.objectStore('hypotheses').put(commit.hypothesis);
      commit.missingToolRequests.forEach((r) => tx.objectStore('missingToolRequests').put(r));
      this.patch(tx, commit.investigationId, {
        ...commit.investigationPatch,
        lastCommittedStep: commit.step.n,
      });
    });
  }

  async flushRawLog(entries: readonly RawLogEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.write(['rawLog'], 'relaxed', (tx) => {
      entries.forEach((entry) => tx.objectStore('rawLog').put(entry));
    });
  }

  async commitVerdict(commit: VerdictCommit): Promise<void> {
    const stores = [
      'investigations',
      'steps',
      'rawLog',
      'observations',
      'hypotheses',
      'missingToolRequests',
    ];
    await this.write(stores, 'strict', (tx) => {
      const store = tx.objectStore('investigations');
      const request = store.get(commit.investigationId);
      request.onsuccess = () => {
        const current = request.result as Investigation | undefined;
        if (!current) {
          tx.abort();
          return;
        }
        if (current.verdict) {
          (tx as IDBTransaction & { gattsbyRefusal?: StoreError }).gattsbyRefusal = new StoreError(
            'ALREADY_CONCLUDED',
            'This investigation already has a verdict.',
          );
          tx.abort();
          return;
        }
        tx.objectStore('steps').put(commit.step);
        commit.rawLog.forEach((entry) => tx.objectStore('rawLog').put(entry));
        commit.observations.forEach((o) => tx.objectStore('observations').put(o));
        if (commit.hypothesis) tx.objectStore('hypotheses').put(commit.hypothesis);
        commit.missingToolRequests.forEach((r) => tx.objectStore('missingToolRequests').put(r));
        store.put({
          ...current,
          ...commit.investigationPatch,
          verdict: commit.verdict,
          lastCommittedStep: commit.step.n,
        });
      };
    });
  }

  async recover(id: string): Promise<Investigation> {
    let recovered: Investigation | null = null;
    await this.write(['investigations', 'rawLog', 'recordings'], 'strict', (tx) => {
      const request = tx.objectStore('investigations').get(id);
      request.onsuccess = () => {
        const current = request.result as Investigation | undefined;
        if (!current) return;
        const above = IDBKeyRange.bound(
          [id, current.lastCommittedStep + 1],
          [id, Number.MAX_SAFE_INTEGER],
        );
        for (const name of ['rawLog', 'recordings']) {
          const index = tx.objectStore(name).index('byStep');
          index.openKeyCursor(above).onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
            if (!cursor) return;
            tx.objectStore(name).delete(cursor.primaryKey);
            cursor.continue();
          };
        }
        recovered =
          current.status === 'running'
            ? { ...current, status: 'paused', interruptedAt: Date.now() }
            : current;
        tx.objectStore('investigations').put(recovered);
      };
    });
    if (!recovered) throw new StoreError('NOT_FOUND', 'No investigation with that id.');
    return recovered;
  }

  async get(id: string): Promise<InvestigationRecord> {
    const db = await this.open();
    const names = ['investigations', 'steps', 'observations', 'hypotheses', 'missingToolRequests'];
    const tx = db.transaction(names, 'readonly');
    const range = investigationRange(id);
    const [investigation, steps, observations, hypotheses, missingToolRequests] = await Promise.all(
      [
        request(tx.objectStore('investigations').get(id)),
        request(tx.objectStore('steps').getAll(range)),
        request(tx.objectStore('observations').getAll(range)),
        request(tx.objectStore('hypotheses').getAll(range)),
        request(tx.objectStore('missingToolRequests').getAll(range)),
      ],
    );
    if (!investigation) throw new StoreError('NOT_FOUND', 'No investigation with that id.');
    return { investigation, steps, observations, hypotheses, missingToolRequests };
  }

  async list(): Promise<Investigation[]> {
    const db = await this.open();
    const tx = db.transaction('investigations', 'readonly');
    const all = await request(tx.objectStore('investigations').index('byStartedAt').getAll());
    return (all as Investigation[]).reverse();
  }

  async rawLog(id: string): Promise<RawLogEntry[]> {
    const db = await this.open();
    const tx = db.transaction('rawLog', 'readonly');
    return (await request(
      tx.objectStore('rawLog').getAll(investigationRange(id)),
    )) as RawLogEntry[];
  }

  async usage(): Promise<{
    open: boolean;
    persisted: boolean;
    quotaBytes: number;
    usageBytes: number;
  }> {
    const open = await this.open().then(
      () => true,
      () => false,
    );
    const estimate = (await navigator.storage?.estimate?.().catch(() => undefined)) ?? {};
    const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
    return {
      open,
      persisted,
      quotaBytes: estimate.quota ?? 0,
      usageBytes: estimate.usage ?? 0,
    };
  }

  async requestPersistence(): Promise<boolean> {
    const asked = await this.setting('persistenceRequested');
    if (asked) return (await this.setting('persistenceGranted')) === true;
    const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    await this.write(['settings'], 'strict', (tx) => {
      tx.objectStore('settings').put({ key: 'persistenceRequested', value: true });
      tx.objectStore('settings').put({ key: 'persistenceGranted', value: granted });
    });
    return granted;
  }

  private async setting(key: string): Promise<unknown> {
    const db = await this.open();
    const row = await request(
      db.transaction('settings', 'readonly').objectStore('settings').get(key),
    );
    return (row as { value?: unknown } | undefined)?.value;
  }

  private patch(tx: IDBTransaction, id: string, patch: object): void {
    const store = tx.objectStore('investigations');
    const current = store.get(id);
    current.onsuccess = () => {
      if (current.result) store.put({ ...current.result, ...patch });
    };
  }

  private async write(
    stores: string[],
    durability: IDBTransactionDurability,
    work: (tx: IDBTransaction) => void,
  ): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite', { durability });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(toStoreError(tx));
      tx.onerror = (event) => event.preventDefault();
      work(tx);
    });
  }

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new StoreError('STORAGE_UNAVAILABLE', 'Chrome didn’t answer.')),
        OPEN_TIMEOUT_MS,
      );
      const open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      open.onupgradeneeded = (event) => upgrade(open.result, event.oldVersion);
      open.onsuccess = () => {
        clearTimeout(timer);
        resolve(open.result);
      };
      open.onerror = () => {
        clearTimeout(timer);
        reject(new StoreError('STORAGE_UNAVAILABLE', open.error?.message ?? 'Could not open.'));
      };
      open.onblocked = () => {
        clearTimeout(timer);
        reject(new StoreError('STORAGE_UNAVAILABLE', 'Another tab holds an older version.'));
      };
    }).catch((error: unknown) => {
      this.database = null;
      throw error;
    });
    return this.database;
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function toStoreError(tx: IDBTransaction): StoreError {
  const refusal = (tx as IDBTransaction & { gattsbyRefusal?: StoreError }).gattsbyRefusal;
  if (refusal) return refusal;
  if (tx.error?.name === 'QuotaExceededError') {
    return new StoreError('STORAGE_FULL', 'Storage is full.');
  }
  return new StoreError('STORAGE_UNAVAILABLE', tx.error?.message ?? 'The transaction failed.');
}
