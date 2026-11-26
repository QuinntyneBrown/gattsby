import { Injectable } from '@angular/core';
import type { CapabilityDiagnostic } from '../environment/capability-diagnostic';
import { InvestigationStore } from './investigation-store';
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  investigationRange,
  OPEN_TIMEOUT_MS,
  upgrade,
} from './database-schema';
import type { Investigation, NewInvestigation } from './model/investigation';
import type { InvestigationPhoto } from './model/investigation-photo';
import type { InvestigationNote } from './model/investigation-note';
import type { DeviceProfile } from './model/device-profile';
import type { InvestigationRecord } from './model/investigation-record';
import type { RawLogEntry } from './model/raw-log-entry';
import type { Recording } from './model/recording';
import type { StepCommit } from './model/step-commit';
import type { VerdictCommit } from './model/verdict-commit';
import { StoreError } from './store-error';
import { validateNote } from './validate-note';

const RECORD_FORMAT = 1;
const EXPORT_PAGE_SIZE = 2000;

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
      'recordings',
      'observations',
      'hypotheses',
      'missingToolRequests',
    ];
    await this.write(stores, 'strict', (tx) => {
      tx.objectStore('steps').put(commit.step);
      commit.rawLog.forEach((entry) => tx.objectStore('rawLog').put(entry));
      commit.recordings.forEach((recording) => tx.objectStore('recordings').put(recording));
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

  async latchEmergencyStop(id: string, at: number): Promise<void> {
    await this.write(['investigations'], 'strict', (tx) => {
      this.patch(tx, id, { emergencyStoppedAt: at });
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
      'profiles',
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
        const profile = current.location
          ? { ...commit.profile, location: current.location }
          : commit.profile;
        tx.objectStore('profiles').add(profile);
        store.put({
          ...current,
          ...commit.investigationPatch,
          verdict: commit.verdict,
          profileId: commit.profile.id,
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

  async getInvestigation(id: string): Promise<Investigation> {
    const db = await this.open();
    const row = await request(
      db.transaction('investigations').objectStore('investigations').get(id),
    );
    if (!row) throw new StoreError('NOT_FOUND', 'No investigation with that id.');
    return row as Investigation;
  }

  async saveNote(id: string, input: InvestigationNote): Promise<InvestigationNote> {
    const details = validateNote(input);
    await this.write(['investigations', 'profiles'], 'strict', (tx) => {
      const store = tx.objectStore('investigations');
      const lookup = store.get(id);
      lookup.onsuccess = () => {
        const current = lookup.result as Investigation | undefined;
        if (!current) {
          refuse(tx, new StoreError('NOT_FOUND', 'No investigation with that id.'));
          return;
        }
        if (!details.location && !details.note && !current.location && !current.note) {
          refuse(tx, new StoreError('EMPTY_NOTE', 'Add a location or a note before saving.'));
          return;
        }
        // Keep these fields independent of step data so a concurrent step commit preserves them.
        const location = details.location || undefined;
        store.put({ ...current, location, note: details.note || undefined });
        if (current.profileId) {
          const profiles = tx.objectStore('profiles');
          const lookup = profiles.get(current.profileId);
          lookup.onsuccess = () => {
            const profile = lookup.result as DeviceProfile | undefined;
            if (profile) profiles.put({ ...profile, location });
          };
        }
      };
    });
    return details;
  }

  async rawLog(id: string): Promise<RawLogEntry[]> {
    const db = await this.open();
    const tx = db.transaction('rawLog', 'readonly');
    return (await request(
      tx.objectStore('rawLog').getAll(investigationRange(id)),
    )) as RawLogEntry[];
  }

  async rawEvidence(id: string, ids: readonly string[]): Promise<RawLogEntry[]> {
    const db = await this.open();
    const store = db.transaction('rawLog').objectStore('rawLog');
    const rows = await Promise.all(
      ids
        .filter((evidence) => /^r-\d+$/.test(evidence))
        .map(
          (evidence) =>
            request(store.get([id, Number(evidence.slice(2))])) as Promise<RawLogEntry | undefined>,
        ),
    );
    return rows.filter((row) => row !== undefined);
  }

  async *rawLogPages(id: string): AsyncIterable<RawLogEntry[]> {
    const db = await this.open();
    let lower: IDBValidKey = [id];
    let lowerOpen = false;
    for (;;) {
      const range = IDBKeyRange.bound(lower, [id, []], lowerOpen);
      const store = db.transaction('rawLog').objectStore('rawLog');
      const rows = (await request(store.getAll(range, EXPORT_PAGE_SIZE))) as RawLogEntry[];
      if (rows.length === 0) return;
      yield rows;
      if (rows.length < EXPORT_PAGE_SIZE) return;
      lower = [id, rows[rows.length - 1].seq];
      lowerOpen = true;
    }
  }

  async recordings(id: string): Promise<Recording[]> {
    const db = await this.open();
    const store = db.transaction('recordings').objectStore('recordings');
    return (await request(store.getAll(investigationRange(id)))) as Recording[];
  }

  async rawLogSizeEstimate(id: string): Promise<number> {
    const db = await this.open();
    const store = db.transaction('rawLog').objectStore('rawLog');
    const range = investigationRange(id);
    const [count, sample] = await Promise.all([
      request(store.count(range)),
      request(store.getAll(range, 32)) as Promise<RawLogEntry[]>,
    ]);
    if (!sample.length) return 0;
    return Math.round((new Blob([JSON.stringify(sample)]).size / sample.length) * count);
  }

  async photos(id: string): Promise<InvestigationPhoto[]> {
    const db = await this.open();
    const store = db.transaction('photos').objectStore('photos');
    return (await request(store.getAll(investigationRange(id)))) as InvestigationPhoto[];
  }

  async photoCount(id: string): Promise<number> {
    const db = await this.open();
    const store = db.transaction('photos').objectStore('photos');
    return request(store.count(investigationRange(id)));
  }

  async getProfile(id: string): Promise<DeviceProfile> {
    const db = await this.open();
    const row = await request(db.transaction('profiles').objectStore('profiles').get(id));
    if (!row) throw new StoreError('NOT_FOUND', 'No device profile with that id.');
    const { default: validate } = await import('../../schemas/generated/device-profile-1.js');
    if (!validate(row)) {
      throw new StoreError('UNREADABLE_PROFILE', 'This profile couldn’t be opened.');
    }
    return row as DeviceProfile;
  }

  async recordedPackets(
    investigationId: string,
    recordingId: string,
  ): Promise<RawLogEntry[] | null> {
    const db = await this.open();
    const tx = db.transaction(['recordings', 'rawLog'], 'readonly');
    const recording = (await request(
      tx.objectStore('recordings').get([investigationId, recordingId]),
    )) as Recording | undefined;
    if (!recording) return null;
    const rows = (await request(
      tx.objectStore('rawLog').index('byStep').getAll([investigationId, recording.stepN]),
    )) as RawLogEntry[];
    return rows.filter((row) => row.recordingId === recordingId);
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

  async recordCapabilityDiagnostics(rows: readonly CapabilityDiagnostic[]): Promise<void> {
    if (!rows.length) return;
    await this.write(['settings'], 'relaxed', (tx) => {
      const settings = tx.objectStore('settings');
      const key = 'capabilityDiagnostics';
      const lookup = settings.get(key);
      lookup.onsuccess = () => {
        const previous =
          (lookup.result as { value?: CapabilityDiagnostic[] } | undefined)?.value ?? [];
        settings.put({ key, value: [...previous, ...rows].slice(-50) });
      };
    });
  }

  async useAgentWhenAvailable(): Promise<boolean> {
    return (await this.setting('useAgentWhenAvailable')) !== false;
  }

  async setUseAgentWhenAvailable(enabled: boolean): Promise<void> {
    await this.write(['settings'], 'strict', (tx) => {
      tx.objectStore('settings').put({ key: 'useAgentWhenAvailable', value: enabled });
    });
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
      work(tx);
    });
  }

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new StoreError('STORAGE_UNAVAILABLE', 'Chrome didn’t answer.')),
        OPEN_TIMEOUT_MS,
      );
      let open: IDBOpenDBRequest;
      try {
        open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }
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

function refuse(tx: IDBTransaction, error: StoreError): void {
  (tx as IDBTransaction & { gattsbyRefusal?: StoreError }).gattsbyRefusal = error;
  tx.abort();
}
