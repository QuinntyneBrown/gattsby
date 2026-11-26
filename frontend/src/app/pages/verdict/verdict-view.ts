import { DEVICE_TYPE_WORDS } from '../../outcome/device-type-words';
import type { InvestigationRecord } from '../../store/model/investigation-record';
import type { ObservationTag } from '../../store/model/observation';

export interface VerdictItem {
  readonly key: string;
  readonly value: string;
  readonly tag: ObservationTag | null;
}

// What the Verdict page shows, from the stored record (issue-the-verdict design, "What the Verdict
// page shows"). Pure. The device profile's sections replace "Observed" with journey 4.
export interface VerdictView {
  readonly meta: string;
  readonly protocol: string;
  readonly readable: readonly VerdictItem[];
  readonly observed: readonly VerdictItem[];
  readonly undetermined: readonly VerdictItem[];
}

const OBSERVED = new Set([
  'service',
  'device-info',
  'decoded-value',
  'held-by-other',
  'connection-quirk',
]);

export function verdictView(
  record: InvestigationRecord,
  serviceName: (uuid: string) => string | undefined,
): VerdictView {
  const { investigation, steps, observations, hypotheses } = record;
  const hypothesis = hypotheses.at(-1) ?? null;
  const type = hypothesis?.deviceType ? DEVICE_TYPE_WORDS[hypothesis.deviceType] : null;
  const firmware = observations.find(
    (o) => o.kind === 'device-info' && o.subject === 'firmware',
  )?.value;
  const identity =
    [hypothesis?.model, type].filter(Boolean).join(' ') ||
    investigation.deviceName ||
    'Unknown device';
  const minutes = Math.max(
    1,
    Math.round(((investigation.endedAt ?? Date.now()) - investigation.startedAt) / 60000),
  );
  const meta = [
    identity,
    hypothesis?.maker,
    firmware ? `firmware ${firmware}` : null,
    `${minutes} min`,
    `${steps.length} steps`,
  ]
    .filter(Boolean)
    .join(' · ');
  const verdict = investigation.verdict;
  const service = hypothesis?.contributions.find((c) => c.rule === 'serviceInLayout')
    ?.observationIds[0];
  const serviceObservation = observations.find((o) => o.id === service);
  const protocol = hypothesis
    ? `${hypothesis.protocol}${type ? ` · ${capitalise(type)}` : ''}${serviceObservation ? ` (${serviceObservation.value})` : ''}${
        verdict?.kind === 'connected' ? '' : ' · not verified with live data'
      }`
    : 'Not identified';
  const observed = observations.filter((o) => OBSERVED.has(o.kind)).map(verdictItem);
  const readable = observations.filter((o) => o.kind === 'metric-confirmed').map(verdictItem);
  const undetermined: VerdictItem[] = [];
  if (verdict?.kind !== 'connected' && hypothesis) {
    undetermined.push({ key: 'Live data', value: 'no metric has been confirmed yet', tag: null });
  }
  for (const o of observations.filter((x) => x.kind === 'service' && x.tag === 'guess')) {
    undetermined.push({
      key: o.text,
      value: serviceName(o.subject) ? '' : 'not in the knowledge base',
      tag: null,
    });
  }
  undetermined.push({
    key: 'Services Chrome hides',
    value: 'anything outside the known list is invisible',
    tag: null,
  });
  return { meta, protocol, readable, observed, undetermined };
}

function verdictItem(observation: { text: string; tag: ObservationTag }): VerdictItem {
  const [key, ...rest] = observation.text.split(': ');
  return { key, value: rest.join(': '), tag: observation.tag };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
