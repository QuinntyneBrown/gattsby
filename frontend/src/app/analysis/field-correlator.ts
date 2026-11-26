import type { FieldCandidate } from './field-candidate';
import { groupPackets } from './group-packets';
import type { LabelledRecording } from './labelled-recording';
import { readInteger } from './read-integer';
import { findVaryingBytes, MIN_VALUES_PER_RECORDING } from './varying-bytes-finder';

const WIDTHS = [1, 2, 4] as const;
const LITTLE = ['LE'] as const;
const BOTH_ORDERS = ['LE', 'BE'] as const;

export function correlateFields(
  recordings: readonly LabelledRecording[],
  order: readonly string[],
): FieldCandidate[] {
  const levels = new Map(recordings.map(({ id, label }) => [id, order.indexOf(label)]));
  const comparable = recordings.filter(({ id }) => levels.get(id)! >= 0);
  const varying = findVaryingBytes(comparable);
  const ranked: FieldCandidate[] = [];
  for (const group of groupPackets(comparable)) {
    const format = varying.perCharacteristic.find(
      (row) => row.uuid === group.uuid && row.length === group.length,
    );
    if (!format) continue;
    const sets = [...group.recordings].filter(
      ([, packets]) => packets.length >= MIN_VALUES_PER_RECORDING,
    );
    const ordinal = sets.flatMap(([id, packets]) => packets.map(() => levels.get(id)!));
    if (sets.length < 3 || new Set(ordinal).size < 3) continue;
    const levelRanks = ranks(ordinal);
    const constants = new Set(format.constant);
    const counters = new Set(format.counters);
    for (let offset = 0; offset < group.length; offset++) {
      for (const width of WIDTHS) {
        if (offset + width > group.length) continue;
        const offsets = Array.from({ length: width }, (_, index) => offset + index);
        if (
          offsets.every((index) => constants.has(index)) ||
          offsets.some((index) => counters.has(index))
        )
          continue;
        for (const byteOrder of width === 1 ? LITTLE : BOTH_ORDERS) {
          const values = (signed: boolean) =>
            sets.map(([, packets]) =>
              packets.map(({ bytes }) => readInteger(bytes, offset, width, byteOrder, signed)),
            );
          const unsigned = values(false);
          const signed = values(true);
          const unsignedFit = correlation(ranks(unsigned.flat()), levelRanks);
          const signedFit = correlation(ranks(signed.flat()), levelRanks);
          const useSigned = Math.abs(signedFit) > Math.abs(unsignedFit);
          ranked.push({
            uuid: group.uuid,
            length: group.length,
            offset,
            width,
            byteOrder,
            correlation: useSigned ? signedFit : unsignedFit,
            accumulating: (useSigned ? signed : unsigned).every(accumulates),
          });
        }
      }
    }
  }
  return ranked
    .sort(
      (a, b) =>
        Number(a.accumulating) - Number(b.accumulating) ||
        Math.abs(b.correlation) - Math.abs(a.correlation) ||
        a.width - b.width ||
        a.offset - b.offset ||
        Number(a.byteOrder === 'BE') - Number(b.byteOrder === 'BE'),
    )
    .slice(0, 10);
}

function ranks(values: readonly number[]): number[] {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let start = 0;
  while (start < sorted.length) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const rank = (start + end - 1) / 2;
    for (let i = start; i < end; i++) result[sorted[i].index] = rank;
    start = end;
  }
  return result;
}

function correlation(a: readonly number[], b: readonly number[]): number {
  // The average rank is the same for both vectors even when there are ties.
  const average = (a.length - 1) / 2;
  let sum = 0;
  let squaresA = 0;
  let squaresB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - average;
    const y = b[i] - average;
    sum += x * y;
    squaresA += x * x;
    squaresB += y * y;
  }
  return squaresA && squaresB ? sum / Math.sqrt(squaresA * squaresB) : 0;
}

function accumulates(values: readonly number[]): boolean {
  let increasing = 0;
  for (let index = 1; index < values.length; index++) {
    if (values[index] > values[index - 1]) increasing++;
  }
  return increasing / (values.length - 1) >= 0.9;
}
