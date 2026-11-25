import { METRIC_WIDTH } from '../knowledge-base/decoders/flag-layout-decoder';
import type { MetricLayoutField } from '../knowledge-base/decoders/metric-layout-field';
import type { RawLogEntry } from '../store/model/raw-log-entry';
import type { ReadableMetric } from './readable-metric';

const CLAIMS: Readonly<Record<string, readonly string[]>> = {
  averageSpeed: ['Average speed'],
  distance: ['Total distance'],
  incline: ['Inclination'],
  rampAngle: ['Inclination'],
  positiveElevation: ['Elevation gain'],
  negativeElevation: ['Elevation gain'],
  pace: ['Pace'],
  averagePace: ['Pace'],
  totalEnergy: ['Expended energy'],
  energyPerHour: ['Expended energy'],
  energyPerMinute: ['Expended energy'],
  heartRate: ['Heart rate'],
  metabolicEquivalent: ['Metabolic equivalent'],
  elapsed: ['Elapsed time'],
  remaining: ['Remaining time'],
  force: ['Force on belt and power output'],
  power: ['Power', 'Force on belt and power output'],
  averagePower: ['Power'],
  cadence: ['Cadence'],
  averageCadence: ['Cadence'],
  resistance: ['Resistance level'],
};

export function resolveReadableMetrics(
  characteristic: string,
  rows: readonly RawLogEntry[],
  layout: readonly MetricLayoutField[],
  features: { names: readonly string[]; evidence: readonly string[] },
  confirmations: ReadonlyMap<string, readonly string[]>,
): ReadableMetric[] {
  const seen = new Map<string, { field: MetricLayoutField; offset: number; evidence: string }>();
  const intervals: number[] = [];
  let previous = 0;
  for (const row of rows) {
    if (row.uuid !== characteristic) continue;
    if (previous && row.t > previous) intervals.push(row.t - previous);
    previous = row.t;
    for (const field of row.decoded ?? []) {
      if (!seen.has(field.metric))
        seen.set(field.metric, { field, offset: field.offset, evidence: row.id });
    }
  }
  intervals.sort((a, b) => a - b);
  const midpoint = Math.floor(intervals.length / 2);
  const interval =
    intervals.length % 2
      ? intervals[midpoint]
      : midpoint > 0
        ? (intervals[midpoint - 1] + intervals[midpoint]) / 2
        : undefined;
  const rateHz = interval ? 1000 / interval : undefined;
  const fields = new Map(layout.map((f) => [f.metric, f]));
  for (const [key, sample] of seen) fields.set(key, sample.field);
  return Array.from(fields.values()).flatMap((field): ReadableMetric[] => {
    const sample = seen.get(field.metric);
    const claimed = CLAIMS[field.metric]?.some((name) => features.names.includes(name));
    if (!sample && !claimed) return [];
    const confirmation = confirmations.get(field.metric);
    const evidence = new Set([
      ...(claimed ? features.evidence : []),
      ...(sample ? [sample.evidence] : []),
      ...(confirmation ?? []),
    ]);
    const fixedOffset = field.flag === 0 && sample;
    const rule: ReadableMetric['rule'] = fixedOffset
      ? { kind: 'offset', from: sample.offset, to: sample.offset + METRIC_WIDTH[field.type] - 1 }
      : { kind: 'flag', bit: field.flag };
    return [
      {
        characteristic,
        metric: field.metric,
        label: field.label,
        type: field.type,
        scale: field.scale,
        unit: field.unit,
        rule,
        rateHz,
        status: confirmation ? 'confirmed' : sample ? 'claimedOnly' : 'claimedNotSeen',
        quirks:
          sample && CLAIMS[field.metric] && features.evidence.length && !claimed
            ? ['Not claimed in Fitness Machine Feature.']
            : [],
        evidence: [...evidence],
      },
    ];
  });
}
