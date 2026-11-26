import validateRecord from '../../schemas/generated/investigation-record-1.js';
import validateRawLog from '../../schemas/generated/raw-log-page-1.js';
import type { InvestigationStore } from './investigation-store';
import type { DeviceProfile } from './model/device-profile';
import type { InvestigationRecord } from './model/investigation-record';
import type { OperatingMode } from './model/operating-mode';
import type { Step } from './model/step';
import type { VerdictCommit } from './model/verdict-commit';
import { applyMissingToolUpdates } from '../outcome/merge-missing-tool-requests';
import { StoreError } from './store-error';

export async function buildRecordExport(
  store: InvestigationStore,
  profile: DeviceProfile,
  includeNotesAndPhotos: boolean,
  signal: AbortSignal,
  pending?: VerdictCommit,
): Promise<{ blob: Blob; startedAt: number }> {
  const id = profile.investigationId;
  const [stored, recordings, attachments] = await Promise.all([
    store.get(id),
    store.recordings(id),
    includeNotesAndPhotos ? store.photos(id) : store.photoCount(id),
  ]);
  const record = pending ? withPendingVerdict(stored, pending) : stored;
  const {
    startedAt,
    endedAt,
    interruptedAt,
    kbVersion,
    appVersion,
    recordFormat,
    readOnly,
    note,
    modeChanges,
    ...header
  } = record.investigation;
  void readOnly;
  if (recordFormat !== 1)
    throw new StoreError('EXPORT_UNAVAILABLE', 'This record format couldn’t be exported.');
  const notes = note ? [note] : [];
  const { notes: profileNotes, ...profileBody } = profile;
  void profileNotes;
  const payload = {
    kind: 'gattsby.investigation-record',
    formatVersion: '1.2',
    kbVersion,
    appVersion,
    exportedAt: iso(Date.now()),
    includesNotesAndPhotos: includeNotesAndPhotos,
    investigation: {
      ...header,
      startedAt: iso(startedAt),
      endedAt: endedAt === null ? null : iso(endedAt),
      interruptedAt: interruptedAt === null ? null : iso(interruptedAt),
      ...(modeChanges && {
        modeChanges: modeChanges.map((change) => ({ ...change, at: iso(change.at) })),
      }),
    },
    steps: record.steps.map((step) => exportStep(step, modeChanges?.[0]?.from ?? header.mode)),
    observations: record.observations.map(withoutInvestigationId),
    hypotheses: record.hypotheses.map(withoutInvestigationId),
    recordings: recordings.map(withoutInvestigationId),
    missingToolRequests: record.missingToolRequests.map(withoutInvestigationId),
    profile: header.location ? { ...profileBody, location: header.location } : profileBody,
    ...(typeof attachments === 'number'
      ? { omitted: { notes: notes.length, photos: attachments } }
      : {
          notes,
          photos: attachments.map(({ id, mediaType, takenAt, dataBase64 }) => ({
            id,
            mediaType,
            takenAt: iso(takenAt),
            dataBase64,
          })),
        }),
  };
  const metadata = JSON.stringify(payload);
  // Check the JSON shape after serialization too, which drops undefined values.
  if (!validateRecord({ ...JSON.parse(metadata), rawLog: [] })) throw invalidRecord(validateRecord);

  const parts: BlobPart[] = [metadata.slice(0, -1), ',"rawLog":['];
  let first = true;
  for await (const page of recordPages(store, id, pending)) {
    signal.throwIfAborted();
    const rows = page.map(({ t, ...row }) => ({
      ...withoutInvestigationId(row),
      t: t - startedAt,
    }));
    if (!validateRawLog(rows)) throw invalidRecord(validateRawLog);
    parts.push(new Blob([first ? '' : ',', JSON.stringify(rows).slice(1, -1)]));
    first = false;
  }
  parts.push(']}');
  return { blob: new Blob(parts, { type: 'application/json' }), startedAt };
}

function withPendingVerdict(
  record: InvestigationRecord,
  pending: VerdictCommit,
): InvestigationRecord {
  return {
    investigation: {
      ...record.investigation,
      ...pending.investigationPatch,
      verdict: pending.verdict,
      profileId: pending.profile.id,
      lastCommittedStep: pending.step.n,
    },
    steps: [...record.steps, pending.step],
    observations: [...record.observations, ...pending.observations],
    hypotheses: pending.hypothesis ? [...record.hypotheses, pending.hypothesis] : record.hypotheses,
    missingToolRequests: applyMissingToolUpdates(
      record.missingToolRequests,
      pending.missingToolRequests,
    ),
  };
}

async function* recordPages(store: InvestigationStore, id: string, pending?: VerdictCommit) {
  const pendingSeqs = new Set(pending?.rawLog.map((entry) => entry.seq));
  for await (const page of store.rawLogPages(id)) {
    const rows = pendingSeqs.size ? page.filter((entry) => !pendingSeqs.has(entry.seq)) : page;
    if (rows.length) yield rows;
  }
  if (pending?.rawLog.length) yield pending.rawLog;
}

function exportStep(step: Step, investigationMode: OperatingMode) {
  const { investigationId, tool, input, decidedBy, ruleId, startedAt, endedAt, ...row } = step;
  void investigationId;
  return {
    ...row,
    mode: row.mode ?? investigationMode,
    tool,
    action: { type: 'call_tool', tool, input: input ?? null, decidedBy, ruleId },
    startedAt: iso(startedAt),
    endedAt: iso(endedAt),
  };
}

function withoutInvestigationId<T extends { investigationId: string }>(
  row: T,
): Omit<T, 'investigationId'> {
  const { investigationId, ...rest } = row;
  void investigationId;
  return rest;
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function invalidRecord(validator: typeof validateRecord): StoreError {
  const first = validator.errors?.[0];
  console.warn('Gattsby record export validation failed.', first?.instancePath, first?.keyword);
  return new StoreError('EXPORT_UNAVAILABLE', 'The investigation record did not validate.');
}
