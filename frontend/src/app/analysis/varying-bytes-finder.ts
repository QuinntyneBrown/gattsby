import { groupPackets } from './group-packets';
import type { LabelledRecording } from './labelled-recording';
import type { PacketSample } from './packet-sample';
import { sequenceCounter } from './sequence-counter';

export const MIN_VALUES_PER_RECORDING = 5;

export function findVaryingBytes(recordings: readonly LabelledRecording[]) {
  const perCharacteristic = [];
  const skipped = [];
  for (const { uuid, length, recordings: matching } of groupPackets(recordings)) {
    const samples = [...matching.values()];
    if (
      samples.length < 2 ||
      samples.some((packets) => packets.length < MIN_VALUES_PER_RECORDING)
    ) {
      skipped.push({ uuid, length, reason: 'Fewer than five packets in a comparable recording' });
      continue;
    }
    const classes = classifyOffsets(length, samples);
    const packets = [...matching].map(([recordingId, values]) => ({
      recordingId,
      rawLogId: values[0].id,
    }));
    perCharacteristic.push({ uuid, length, ...classes, packets });
  }
  return { perCharacteristic, skipped };
}

function classifyOffsets(length: number, samples: readonly PacketSample[][]) {
  const betweenLabels: number[] = [];
  const withinLabel: number[] = [];
  const constant: number[] = [];
  const counters: number[] = [];
  for (let offset = 0; offset < length; offset++) {
    const values = samples.map((packets) => packets.map(({ bytes }) => bytes[offset]));
    const sets = values.map((sample) => new Set(sample));
    if (sets.every((set) => set.size === 1 && set.has(values[0][0]))) {
      constant.push(offset);
      continue;
    }
    const steps = values.map((sample) => sequenceCounter(sample)?.step);
    if (steps[0] && steps.every((step) => step === steps[0])) {
      counters.push(offset);
      withinLabel.push(offset);
    } else if (
      sets.some((left, index) =>
        sets.slice(index + 1).some((right) => [...left].every((value) => !right.has(value))),
      )
    ) {
      betweenLabels.push(offset);
    } else {
      withinLabel.push(offset);
    }
  }
  return { betweenLabels, withinLabel, constant, counters };
}
