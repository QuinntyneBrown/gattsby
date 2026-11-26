import { ImportError } from './import-error';
import type { ImportedInvestigation } from './model/imported-investigation';
import type { InvestigationRecordDocument } from './model/investigation-record-document';

export function restoreInvestigation(file: InvestigationRecordDocument): ImportedInvestigation {
  const { startedAt, endedAt, interruptedAt, modeChanges, ...header } = file.investigation;
  const { id } = header;
  if (!/^i-[a-zA-Z0-9-]{1,100}$/.test(id)) invalid('/investigation/id');
  if (header.profileId !== (file.profile?.id ?? null)) invalid('/investigation/profileId');
  if (file.profile && file.profile.investigationId !== id) invalid('/profile/investigationId');
  if ((file.notes?.length ?? 0) > 1) invalid('/notes');
  const start = time(startedAt, '/investigation/startedAt');
  const withId = <T extends object>(row: T) => ({ ...row, investigationId: id });
  const steps = file.steps.map(({ action, startedAt, endedAt, ...step }) =>
    withId({
      ...step,
      input: action.input,
      decidedBy: action.decidedBy,
      ruleId: action.ruleId ?? null,
      startedAt: time(startedAt, '/steps/startedAt'),
      endedAt: time(endedAt, '/steps/endedAt'),
    }),
  );
  const rows = {
    rawLog: file.rawLog.map((packet) => {
      if (packet.id !== `r-${packet.seq}`) invalid('/rawLog/id');
      const t = packet.t + start;
      if (!Number.isFinite(new Date(t).getTime())) invalid('/rawLog/t');
      return withId({ ...packet, t });
    }),
    steps,
    observations: file.observations.map(withId),
    hypotheses: file.hypotheses.map(withId),
    recordings: file.recordings.map(withId),
    missingToolRequests: file.missingToolRequests.map((row) =>
      withId({
        ...row,
        evidence: row.evidence ?? [],
        stepN: row.stepN ?? 0,
        createdAt: row.createdAt ?? start,
      }),
    ),
    photos:
      file.photos?.map(({ takenAt, ...photo }) =>
        withId({ ...photo, takenAt: time(takenAt, '/photos/takenAt') }),
      ) ?? [],
  };
  for (const [name, list] of Object.entries(rows)) {
    if (new Set(list.map(({ id }) => id)).size !== list.length) invalid(`/${name}/id`);
  }
  if (new Set(steps.map(({ n }) => n)).size !== steps.length) invalid('/steps/n');
  if (new Set(rows.hypotheses.map(({ version }) => version)).size !== rows.hypotheses.length)
    invalid('/hypotheses/version');
  if (
    new Set(rows.missingToolRequests.map(({ capabilityKey }) => capabilityKey)).size !==
    rows.missingToolRequests.length
  )
    invalid('/missingToolRequests/capabilityKey');

  return {
    ...rows,
    investigation: {
      ...header,
      readOnly: true,
      appVersion: file.appVersion,
      kbVersion: file.kbVersion,
      recordFormat: 1,
      startedAt: start,
      endedAt: endedAt === null ? null : time(endedAt, '/investigation/endedAt'),
      interruptedAt:
        interruptedAt === null ? null : time(interruptedAt, '/investigation/interruptedAt'),
      ...(modeChanges && {
        modeChanges: modeChanges.map(({ at, ...change }) => ({
          ...change,
          at: time(at, '/investigation/modeChanges/at'),
        })),
      }),
      ...(file.notes?.[0] !== undefined && { note: file.notes[0] }),
    },
    profile: file.profile,
    includesNotesAndPhotos: file.includesNotesAndPhotos,
  };
}

function time(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) invalid(field);
  return timestamp;
}

function invalid(field: string): never {
  throw new ImportError(
    'SCHEMA_INVALID',
    'This file doesn’t match the investigation record format.',
    field,
  );
}
