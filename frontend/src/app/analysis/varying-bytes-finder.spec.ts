import { describe, expect, it } from 'vitest';
import type { LabelledRecording } from './labelled-recording';
import { findVaryingBytes } from './varying-bytes-finder';

function recording(label: string, level: number, count = 6): LabelledRecording {
  return {
    id: `rec-${label}`,
    label,
    characteristics: ['data'],
    packets: Array.from({ length: count }, (_, index) => ({
      uuid: 'data',
      id: `${label}-${index}`,
      bytes: Uint8Array.of(0xf0, 250 + index, index % 2 ? 1 : 4, 5, 9, level),
    })),
  };
}

describe('Find varying bytes', () => {
  it('distinguishes byte 5 from the counter, noise and constant bytes', () => {
    const report = findVaryingBytes([recording('idle', 0), recording('slow', 7)]);
    expect(report.perCharacteristic).toEqual([
      expect.objectContaining({
        uuid: 'data',
        length: 6,
        betweenLabels: [5],
        withinLabel: [1, 2],
        counters: [1],
        constant: [0, 3, 4],
        packets: [
          { recordingId: 'rec-idle', rawLogId: 'idle-0' },
          { recordingId: 'rec-slow', rawLogId: 'slow-0' },
        ],
      }),
    ]);
  });

  it('reports a short recording as insufficient even when the other has enough data', () => {
    const { perCharacteristic, skipped } = findVaryingBytes([
      recording('idle', 0, 3),
      recording('fast', 12),
    ]);
    expect(perCharacteristic).toEqual([]);
    expect(skipped).toContainEqual(expect.objectContaining({ uuid: 'data', length: 6 }));
  });
});
