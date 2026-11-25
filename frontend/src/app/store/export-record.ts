import validateRecord from '../../schemas/generated/investigation-record-1.js';
import validateRawLog from '../../schemas/generated/raw-log-page-1.js';
import type { InvestigationStore } from './investigation-store';
import type { DeviceProfile } from './model/device-profile';
import type { Step } from './model/step';
import { StoreError } from './store-error';

export async function buildRecordExport(
  store: InvestigationStore,
  profile: DeviceProfile,
  includeNotesAndPhotos: boolean,
  signal: AbortSignal,
): Promise<{ blob: Blob; startedAt: number }> {
  const id = profile.investigationId;
  const [record, recordings, attachments] = await Promise.all([
    store.get(id),
    store.recordings(id),
    includeNotesAndPhotos ? store.photos(id) : store.photoCount(id),
  ]);
  const {
    startedAt,
    endedAt,
    interruptedAt,
    kbVersion,
    appVersion,
    recordFormat,
    note,
    ...header
  } = record.investigation;
  if (recordFormat !== 1)
    throw new StoreError('EXPORT_UNAVAILABLE', 'This record format couldn’t be exported.');
  const notes = note ? [note] : [];
  const payload = {
    kind: 'gattsby.investigation-record',
    formatVersion: '1.0',
    kbVersion,
    appVersion,
    exportedAt: iso(Date.now()),
    includesNotesAndPhotos: includeNotesAndPhotos,
    investigation: {
      ...header,
      startedAt: iso(startedAt),
      endedAt: endedAt === null ? null : iso(endedAt),
      interruptedAt: interruptedAt === null ? null : iso(interruptedAt),
    },
    steps: record.steps.map(exportStep),
    observations: record.observations.map(withoutInvestigationId),
    hypotheses: record.hypotheses.map(withoutInvestigationId),
    recordings: recordings.map(withoutInvestigationId),
    missingToolRequests: record.missingToolRequests.map(withoutInvestigationId),
    profile,
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

  const parts = [metadata.slice(0, -1), ',"rawLog":['];
  let first = true;
  for await (const page of store.rawLogPages(id)) {
    signal.throwIfAborted();
    const rows = page.map(({ t, ...row }) => ({
      ...withoutInvestigationId(row),
      t: t - startedAt,
    }));
    if (!validateRawLog(rows)) throw invalidRecord(validateRawLog);
    if (!first) parts.push(',');
    parts.push(JSON.stringify(rows).slice(1, -1));
    first = false;
  }
  parts.push(']}');
  return { blob: new Blob(parts, { type: 'application/json' }), startedAt };
}

function exportStep(step: Step) {
  const { investigationId, tool, input, decidedBy, ruleId, startedAt, endedAt, ...row } = step;
  void investigationId;
  return {
    ...row,
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
