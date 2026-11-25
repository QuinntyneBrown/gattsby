import type { DecodedMetric } from '../../knowledge-base/decoders/decoded-metric';
import type { Decoder } from '../../knowledge-base/decoders/decoder';
import type { RawLogEntry } from '../../store/model/raw-log-entry';

export function parseHex(hex: string): Uint8Array | null {
  const compact = hex.replace(/\s+/g, '');
  if (!/^(?:[0-9a-f]{2}){1,512}$/i.test(compact)) return null;
  return Uint8Array.from(compact.match(/../g)!, (part) => Number.parseInt(part, 16));
}

export function decodeFields(decoder: Decoder, bytes: Uint8Array) {
  const result = decoder.decode(bytes);
  const fields = Array.isArray(result.value) ? (result.value as readonly DecodedMetric[]) : [];
  return { fields: fields.map((field) => ({ ...field, name: field.label })), summary: result.text };
}

export function analyseStandardRecording(
  rows: readonly RawLogEntry[],
  characteristic: string,
  decoder: Decoder,
) {
  const values: { rawLogId: string; fields: ReturnType<typeof decodeFields>['fields'] }[] = [];
  const errors: { index: number; reason: string }[] = [];
  const metrics = new Map<string, { min: number; max: number; first: number; last: number }>();
  rows
    .filter((row) => row.uuid === characteristic)
    .forEach((row, index) => {
      try {
        const bytes = parseHex(row.hex);
        if (!bytes) throw new Error('The notification did not contain valid hex.');
        const { fields } = decodeFields(decoder, bytes);
        values.push({ rawLogId: row.id, fields });
        for (const { metric, value } of fields) {
          const previous = metrics.get(metric);
          if (!previous) {
            metrics.set(metric, { min: value, max: value, first: value, last: value });
          } else {
            previous.min = Math.min(previous.min, value);
            previous.max = Math.max(previous.max, value);
            previous.last = value;
          }
        }
      } catch (error) {
        errors.push({
          index,
          reason: error instanceof Error ? error.message : 'Could not decode.',
        });
      }
    });
  const statistics = Array.from(metrics, ([metric, { min, max, first, last }]) => ({
    metric,
    min,
    max,
    trend: last > first ? 'rising' : last < first ? 'falling' : 'flat',
  }));
  return { values, errors, statistics };
}
