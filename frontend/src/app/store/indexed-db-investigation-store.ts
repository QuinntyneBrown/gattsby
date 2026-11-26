import { Injectable } from '@angular/core';
import type { CapabilityDiagnostic } from '../environment/capability-diagnostic';
import { InvestigationStore } from './investigation-store';
import { canonicalJson } from './canonical-json';
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
import type { ImportedInvestigation } from './model/imported-investigation';
import type { InvestigationRecord } from './model/investigation-record';
import type { MissingToolListEntry } from './model/missing-tool-list-entry';
import type { MissingToolRequest } from './model/missing-tool-request';
import type { LocalDataCounts } from './model/local-data-counts';
import type { RawLogEntry } from './model/raw-log-entry';
import type { Recording } from './model/recording';
import type { StepCommit } from './model/step-commit';
import type { VerdictCommit } from './model/verdict-commit';
import { StoreError } from './store-error';
import { sameDeviceProfile } from './same-device-profile';
import { validateNote } from './validate-note';

const RECORD_FORMAT = 1;
const EXPORT_PAGE_SIZE = 2000;
const INVESTIGATION_ROWS = [
  'steps',
  'rawLog',
  'recordings',
  'observations',
  'hypotheses',
  'photos',
  'missingToolRequests',
] as const;

// The investigation store on IndexedDB (save-as-the-investigation-runs design). Every write
// resolves on the transaction's `complete` event, never on a request's `success`.
@Injectable()
export class IndexedDbInvestigationStore extends InvestigationStore {
  private database: Promise<IDBDatabase> | null = null;
  private deletion: Promise<void> | null = null;

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
      const investigations = tx.objectStore('investigations');
      const current = investigations.get(commit.investigationId);
      current.onsuccess = () => {
        if (!current.result) {
          refuse(tx, new StoreError('NOT_FOUND', 'This investigation was deleted.'));
          return;
        }
        tx.objectStore('steps').put(commit.step);
        commit.rawLog.forEach((entry) => tx.objectStore('rawLog').put(entry));
        commit.recordings.forEach((recording) => tx.objectStore('recordings').put(recording));
        commit.observations.forEach((o) => tx.objectStore('observations').put(o));
        if (commit.hypothesis) tx.objectStore('hypotheses').put(commit.hypothesis);
        commit.missingToolRequests.forEach((r) => tx.objectStore('missingToolRequests').put(r));
        investigations.put({
          ...current.result,
          ...commit.investigationPatch,
          lastCommittedStep: commit.step.n,
        });
      };
    });
  }

  async flushRawLog(entries: readonly RawLogEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const byInvestigation = new Map<string, RawLogEntry[]>();
    for (const entry of entries) {
      const group = byInvestigation.get(entry.investigationId) ?? [];
      group.push(entry);
      byInvestigation.set(entry.investigationId, group);
    }
    await this.write(['investigations', 'rawLog'], 'relaxed', (tx) => {
      const investigations = tx.objectStore('investigations');
      const log = tx.objectStore('rawLog');
      for (const [id, rows] of byInvestigation) {
        const current = investigations.getKey(id);
        current.onsuccess = () => {
          if (current.result !== undefined) rows.forEach((entry) => log.put(entry));
        };
      }
    });
  }

  async discardProvisionalPackets(id: string, stepN: number): Promise<void> {
    await this.write(['investigations', 'rawLog'], 'strict', (tx) => {
      const request = tx.objectStore('investigations').get(id);
      request.onsuccess = () => {
        const current = request.result as Investigation | undefined;
        if (!current || current.lastCommittedStep >= stepN) return;
        const log = tx.objectStore('rawLog');
        log.index('byStep').openKeyCursor(IDBKeyRange.only([id, stepN])).onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
          if (!cursor) return;
          log.delete(cursor.primaryKey);
          cursor.continue();
        };
      };
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

  async recover(id: string, stage?: Investigation['stage']): Promise<Investigation> {
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
          current.status === 'running' || (current.status === 'paused' && stage !== undefined)
            ? {
                ...current,
                stage: stage ?? current.stage,
                status: 'paused',
                interruptedAt: Date.now(),
              }
            : current;
        tx.objectStore('investigations').put(recovered);
      };
    });
    if (!recovered) throw new StoreError('NOT_FOUND', 'No investigation with that id.');
    return recovered;
  }

  async reactivate(
    id: string,
    modeChange?: NonNullable<Investigation['modeChanges']>[number],
  ): Promise<Investigation> {
    let resumed: Investigation | null = null;
    await this.write(['investigations'], 'strict', (tx) => {
      const store = tx.objectStore('investigations');
      const get = store.get(id);
      get.onsuccess = () => {
        const current = get.result as Investigation | undefined;
        if (!current || current.verdict || current.status !== 'paused') return;
        resumed = {
          ...current,
          status: 'running',
          interruptedAt: null,
          ...(modeChange && {
            mode: modeChange.to,
            modeChanges: [...(current.modeChanges ?? []), modeChange],
          }),
        };
        store.put(resumed);
      };
    });
    if (!resumed) throw new StoreError('NOT_FOUND', 'No paused investigation with that id.');
    return resumed;
  }

  async nextRawSequence(id: string): Promise<number> {
    const db = await this.open();
    const cursor = await request(
      db.transaction('rawLog').objectStore('rawLog').openCursor(investigationRange(id), 'prev'),
    );
    return cursor ? (cursor.value as RawLogEntry).seq + 1 : 0;
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

  async delete(id: string): Promise<void> {
    await this.write(['investigations', 'profiles', ...INVESTIGATION_ROWS], 'strict', (tx) => {
      const keys = investigationRange(id);
      for (const name of INVESTIGATION_ROWS) tx.objectStore(name).delete(keys);
      const profiles = tx.objectStore('profiles');
      const profile = profiles.index('byInvestigation').getKey(id);
      profile.onsuccess = () => {
        if (profile.result !== undefined) profiles.delete(profile.result);
      };
      tx.objectStore('investigations').delete(id);
    });
  }

  deleteAll(onBlocked?: () => void): Promise<void> {
    this.deletion ??= this.deleteDatabase(onBlocked).finally(() => {
      this.deletion = null;
    });
    return this.deletion;
  }

  private async deleteDatabase(onBlocked?: () => void): Promise<void> {
    const database = await this.database?.catch(() => null);
    this.database = null;
    database?.close();
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(DATABASE_NAME);
      deletion.onsuccess = () => resolve();
      deletion.onerror = () =>
        reject(new StoreError('STORAGE_UNAVAILABLE', 'Chrome could not delete the stored data.'));
      deletion.onblocked = () => onBlocked?.();
    });
  }

  async localDataCounts(): Promise<LocalDataCounts> {
    const db = await this.open();
    const names = ['investigations', 'profiles', 'photos'];
    const tx = db.transaction(names);
    const [investigations, profiles, photos] = await Promise.all(
      names.map((name) => request(tx.objectStore(name).count())),
    );
    return { investigations, profiles, photos };
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

  async listMissingTools(): Promise<MissingToolListEntry[]> {
    const db = await this.open();
    const tx = db.transaction(['missingToolRequests', 'investigations']);
    const [requests, investigations] = await Promise.all([
      request(tx.objectStore('missingToolRequests').getAll()) as Promise<MissingToolRequest[]>,
      request(tx.objectStore('investigations').getAll()) as Promise<Investigation[]>,
    ]);
    const byId = new Map(investigations.map((row) => [row.id, row]));
    return requests.flatMap((request) => {
      const investigation = byId.get(request.investigationId);
      return investigation
        ? [
            {
              request,
              deviceName: investigation.deviceName ?? 'Unknown device',
              hasVerdict: !!investigation.verdict,
            },
          ]
        : [];
    });
  }

  async rawLogCount(id: string): Promise<number> {
    const db = await this.open();
    const log = db.transaction('rawLog').objectStore('rawLog');
    return request(log.count(investigationRange(id)));
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

  async listProfiles(limit?: number): Promise<DeviceProfile[]> {
    const db = await this.open();
    const { default: validate } = await import('../../schemas/generated/device-profile-1.js');
    const index = db.transaction('profiles').objectStore('profiles').index('byCreatedAt');
    return new Promise((resolve, reject) => {
      const profiles: DeviceProfile[] = [];
      const scan = index.openCursor(null, 'prev');
      scan.onerror = () => reject(scan.error);
      scan.onsuccess = () => {
        const cursor = scan.result;
        if (!cursor || (limit !== undefined && profiles.length >= limit)) {
          resolve(profiles);
          return;
        }
        if (validate(cursor.value)) profiles.push(cursor.value as DeviceProfile);
        cursor.continue();
      };
    });
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

  async importProfile(profile: DeviceProfile, signal: AbortSignal): Promise<boolean> {
    let alreadyStored = false;
    await this.write(
      ['profiles'],
      'strict',
      (tx) => {
        const profiles = tx.objectStore('profiles');
        const match = profiles.get(profile.id);
        match.onsuccess = () => {
          if (match.result) {
            alreadyStored = sameDeviceProfile(match.result as DeviceProfile, profile);
            if (!alreadyStored)
              refuse(tx, new StoreError('ALREADY_EXISTS', 'This profile already exists.'));
            return;
          }
          const related = profiles.index('byInvestigation').getKey(profile.investigationId);
          related.onsuccess = () => {
            if (related.result !== undefined) {
              refuse(
                tx,
                new StoreError('ALREADY_EXISTS', 'This investigation already has a profile.'),
              );
            } else {
              profiles.add(profile);
            }
          };
        };
      },
      signal,
    );
    return alreadyStored;
  }

  async importRecord(record: ImportedInvestigation, signal: AbortSignal): Promise<boolean> {
    const { investigation, profile } = record;
    const id = investigation.id;
    let alreadyStored = false;
    await this.write(
      ['investigations', 'profiles', ...INVESTIGATION_ROWS],
      'strict',
      (tx) => {
        const headers = tx.objectStore('investigations');
        const profiles = tx.objectStore('profiles');
        const existing = headers.get(id);
        existing.onsuccess = () => {
          if (existing.result) {
            void matchesStoredRecord(tx, record, existing.result as Investigation).then(
              (matches) => {
                alreadyStored = matches;
                if (!matches)
                  refuse(
                    tx,
                    new StoreError('ALREADY_EXISTS', 'This investigation already exists.'),
                  );
              },
              () => {
                if (!signal.aborted)
                  refuse(
                    tx,
                    new StoreError('STORAGE_UNAVAILABLE', 'Couldn’t compare the stored record.'),
                  );
              },
            );
            return;
          }
          const storeRows = () => {
            headers.add(investigation);
            for (const name of INVESTIGATION_ROWS) {
              const store = tx.objectStore(name);
              for (const row of record[name]) store.add(row);
            }
          };
          if (!profile) {
            storeRows();
            return;
          }
          const related = profiles.index('byInvestigation').get(id);
          related.onsuccess = () => {
            if (related.result && !sameDeviceProfile(related.result as DeviceProfile, profile)) {
              refuse(
                tx,
                new StoreError(
                  'ALREADY_EXISTS',
                  'This investigation already has a different profile.',
                ),
              );
              return;
            }
            if (!related.result) profiles.add(profile);
            storeRows();
          };
        };
      },
      signal,
    );
    return alreadyStored;
  }

  async recordedPackets(
    investigationId: string,
    recordingId: string,
    limitPerCharacteristic?: number,
  ): Promise<RawLogEntry[] | null> {
    const db = await this.open();
    const tx = db.transaction(['recordings', 'rawLog'], 'readonly');
    const recording = (await request(
      tx.objectStore('recordings').get([investigationId, recordingId]),
    )) as Recording | undefined;
    if (!recording) return null;
    const index = tx.objectStore('rawLog').index('byStep');
    const key = [investigationId, recording.stepN];
    if (limitPerCharacteristic !== undefined) {
      return new Promise<RawLogEntry[]>((resolve, reject) => {
        const rows: RawLogEntry[] = [];
        const counts = new Map<string, number>();
        const scan = index.openCursor(key);
        scan.onerror = () => reject(scan.error);
        scan.onsuccess = () => {
          const cursor = scan.result;
          if (!cursor) {
            resolve(rows);
            return;
          }
          const row = cursor.value as RawLogEntry;
          if (
            row.recordingId === recordingId &&
            row.uuid &&
            recording.characteristics.includes(row.uuid)
          ) {
            const count = counts.get(row.uuid) ?? 0;
            if (count < limitPerCharacteristic) {
              counts.set(row.uuid, count + 1);
              rows.push(row);
            }
          }
          cursor.continue();
        };
      });
    }
    const rows = (await request(index.getAll(key))) as RawLogEntry[];
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

  async requestPersistence(tryAgain = false): Promise<boolean> {
    const asked = await this.setting('persistenceRequested');
    if (asked && !tryAgain) return (await this.setting('persistenceGranted')) === true;
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
    signal?: AbortSignal,
  ): Promise<void> {
    const db = await this.open();
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite', { durability });
      const abort = () => {
        try {
          tx.abort();
        } catch {
          /* The transaction already finished. */
        }
      };
      const release = () => signal?.removeEventListener('abort', abort);
      signal?.addEventListener('abort', abort, { once: true });
      tx.oncomplete = () => {
        release();
        resolve();
      };
      tx.onabort = () => {
        release();
        reject(signal?.aborted ? signal.reason : toStoreError(tx));
      };
      try {
        work(tx);
      } catch (error) {
        abort();
        release();
        reject(error);
      }
    });
  }

  private open(): Promise<IDBDatabase> {
    if (this.deletion) return this.deletion.then(() => this.open());
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
        const database = open.result;
        database.onversionchange = () => {
          database.close();
          this.database = null;
        };
        resolve(database);
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

async function matchesStoredRecord(
  tx: IDBTransaction,
  incoming: ImportedInvestigation,
  saved: Investigation,
): Promise<boolean> {
  const comparableHeader = (header: Investigation) => {
    return {
      ...header,
      readOnly: undefined,
      note: incoming.includesNotesAndPhotos ? header.note : undefined,
    };
  };
  if (
    canonicalJson(comparableHeader(saved)) !==
    canonicalJson(comparableHeader(incoming.investigation))
  )
    return false;
  const keys = investigationRange(saved.id);
  const rowChecks = INVESTIGATION_ROWS.filter(
    (key) => key !== 'photos' || incoming.includesNotesAndPhotos,
  ).map(async (key) => {
    const previous = (await request(tx.objectStore(key).getAll(keys))) as { id: string }[];
    const order = (rows: readonly { id: string }[]) =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id));
    return canonicalJson(order(previous)) === canonicalJson(order(incoming[key]));
  });
  const profile = incoming.profile;
  if (profile)
    rowChecks.push(
      request(tx.objectStore('profiles').get(profile.id)).then(
        (stored: DeviceProfile | undefined) => !!stored && sameDeviceProfile(stored, profile),
      ),
    );
  return (await Promise.all(rowChecks)).every(Boolean);
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
