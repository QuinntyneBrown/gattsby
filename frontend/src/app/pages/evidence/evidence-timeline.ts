import type { InvestigationStore } from '../../store/investigation-store';
import type { InvestigationRecord } from '../../store/model/investigation-record';
import type { RawLogEntry } from '../../store/model/raw-log-entry';
import type { EvidenceFilter } from './evidence-filter';
import type { EvidenceRow } from './evidence-row';

const PAGE_SIZE = 100;
const MAX_REFERENCES = 512;

export async function readEvidencePage(
  store: InvestigationStore,
  record: InvestigationRecord,
  ref: string | readonly string[] | undefined,
  filter: EvidenceFilter,
  page: number,
  signal: AbortSignal,
): Promise<{ rows: readonly EvidenceRow[]; more: boolean }> {
  const references = ref ? resolveReferences(record, typeof ref === 'string' ? [ref] : ref) : null;
  const context = contextEntries(record).filter((row) => !references || references.has(row.id));
  const readPackets =
    filter === 'All' || filter === 'Sent' || filter === 'Received'
      ? packetsFor(store, record, references)
      : [];
  const rows: EvidenceRow[] = [];
  let remaining = page * PAGE_SIZE;
  for await (const row of chronologicalRows(context, readPackets)) {
    signal.throwIfAborted();
    if (filter !== 'All' && row.author !== filter) continue;
    if (remaining > 0) {
      remaining--;
      continue;
    }
    if (rows.length === PAGE_SIZE) return { rows, more: true };
    rows.push(row);
  }
  return { rows, more: false };
}

function resolveReferences(record: InvestigationRecord, initial: readonly string[]): Set<string> {
  const indexed = new Map<string, readonly string[]>(
    [...record.observations, ...record.hypotheses, ...record.missingToolRequests].map(
      ({ id, evidence }) => [id, evidence],
    ),
  );
  for (const step of record.steps) indexed.set(step.id, step.result.evidence);
  const selected = new Set(initial.slice(0, 64));
  for (const id of selected) {
    if (selected.size >= MAX_REFERENCES) break;
    for (const child of (indexed.get(id) ?? []).slice(0, MAX_REFERENCES - selected.size))
      selected.add(child);
  }
  return selected;
}

async function* packetsFor(
  store: InvestigationStore,
  { investigation: { id, lastCommittedStep } }: InvestigationRecord,
  references: Set<string> | null,
): AsyncGenerator<RawLogEntry> {
  if (references && ![...references].some((entry) => entry.startsWith('rec-'))) {
    const raw = await store.rawEvidence(id, [...references]);
    yield* raw
      .filter(({ stepN }) => stepN <= lastCommittedStep)
      .sort((a, b) => a.t - b.t || a.seq - b.seq);
    return;
  }
  for await (const raw of store.rawLogPages(id)) {
    yield* raw
      .filter(
        ({ stepN, id, recordingId }) =>
          stepN <= lastCommittedStep &&
          (!references || references.has(id) || !!(recordingId && references.has(recordingId))),
      )
      .sort((a, b) => a.t - b.t || a.seq - b.seq);
  }
}

async function* chronologicalRows(
  context: readonly EvidenceRow[],
  packets: AsyncIterable<RawLogEntry> | readonly RawLogEntry[],
): AsyncGenerator<EvidenceRow> {
  let i = 0;
  for await (const packet of packets) {
    while (i < context.length && context[i].at <= packet.t) yield context[i++];
    yield {
      id: packet.id,
      at: packet.t,
      author: packet.direction === 'out' ? 'Sent' : 'Received',
      packet,
    };
  }
  yield* context.slice(i);
}

function contextEntries(record: InvestigationRecord): EvidenceRow[] {
  const { investigation, steps, observations, hypotheses, missingToolRequests } = record;
  const rows: EvidenceRow[] = [
    {
      id: 'investigation-started',
      at: investigation.startedAt,
      author: 'Agent',
      text: `Investigation started · ${investigation.mode === 'agent' ? 'Agent' : 'Checklist'} mode · knowledge base ${investigation.kbVersion}`,
    },
  ];
  const stepsByNumber = new Map(steps.map((step) => [step.n, step]));
  for (const step of steps) {
    rows.push({
      id: step.id,
      at: step.endedAt,
      author: 'Agent',
      text: step.message?.text ?? step.result.summary,
      evidence: step.result.evidence,
    });
    if (step.exchange)
      rows.push({
        id: `${step.id}-answer`,
        at: step.endedAt,
        author: 'You',
        text: step.exchange.skipped ? `Skipped ${step.exchange.prompt}` : step.exchange.answer,
      });
    if (step.approval)
      rows.push({
        id: step.approval.id,
        at: step.approval.decidedAt,
        author: 'You',
        text: `Approval ${step.approval.id} · ${step.approval.decision}`,
      });
  }
  for (const observation of observations)
    rows.push({
      id: observation.id,
      at: stepsByNumber.get(observation.stepN)?.endedAt ?? investigation.startedAt,
      author: 'Agent',
      text: observation.text,
      evidence: observation.evidence,
    });
  for (const hypothesis of hypotheses)
    rows.push({
      id: hypothesis.id,
      at: hypothesis.createdAt,
      author: 'Agent',
      text: `Hypothesis ${hypothesis.label} · Confidence ${Math.round(hypothesis.confidence * 100)}%`,
      evidence: hypothesis.evidence,
    });
  for (const request of missingToolRequests)
    rows.push({
      id: request.id,
      at: request.createdAt,
      author: 'Agent',
      text: `Missing-tool request · ${request.title} · ${request.reason}`,
      evidence: request.evidence,
    });
  return rows.sort((a, b) => a.at - b.at);
}
