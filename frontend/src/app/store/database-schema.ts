// The `gattsby` database, version 1 (save-as-the-investigation-runs design). A later version adds
// an upgrade step here; it never edits version 1's.
export const DATABASE_NAME = 'gattsby';
export const DATABASE_VERSION = 1;

/** Opens within this time or reports `STORAGE_UNAVAILABLE` (a proposed limit). */
export const OPEN_TIMEOUT_MS = 5000;

const PER_INVESTIGATION = ['steps', 'observations', 'hypotheses', 'photos'] as const;

export function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    const investigations = db.createObjectStore('investigations', { keyPath: 'id' });
    investigations.createIndex('byStartedAt', 'startedAt');
    investigations.createIndex('byStatus', 'status');
    for (const name of PER_INVESTIGATION) {
      db.createObjectStore(name, { keyPath: ['investigationId', keyOf(name)] });
    }
    const rawLog = db.createObjectStore('rawLog', { keyPath: ['investigationId', 'seq'] });
    rawLog.createIndex('byStep', ['investigationId', 'stepN']);
    const recordings = db.createObjectStore('recordings', { keyPath: ['investigationId', 'id'] });
    recordings.createIndex('byStep', ['investigationId', 'stepN']);
    const profiles = db.createObjectStore('profiles', { keyPath: 'id' });
    profiles.createIndex('byInvestigation', 'investigationId', { unique: true });
    profiles.createIndex('byCreatedAt', 'createdAt');
    profiles.createIndex('byDeviceType', 'deviceType');
    const requests = db.createObjectStore('missingToolRequests', {
      keyPath: ['investigationId', 'id'],
    });
    requests.createIndex('byCapabilityKey', 'capabilityKey');
    requests.createIndex('byInvestigationAndKey', ['investigationId', 'capabilityKey'], {
      unique: true,
    });
    db.createObjectStore('settings', { keyPath: 'key' });
  }
}

function keyOf(store: (typeof PER_INVESTIGATION)[number]): string {
  switch (store) {
    case 'steps':
      return 'n';
    case 'hypotheses':
      return 'version';
    default:
      return 'id';
  }
}

/** Every row of one investigation in a store keyed `[investigationId, …]`. */
export function investigationRange(id: string): IDBKeyRange {
  return IDBKeyRange.bound([id], [id, []]);
}
