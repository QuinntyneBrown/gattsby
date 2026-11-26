import { describe, expect, it } from 'vitest';
import { guessEncodings } from './field-encoding-guesser';

const samples = [300, 500, 700, 300, 500, 700].map((value) =>
  Uint8Array.of(0xf0, value & 0xff, value >> 8),
);

describe('Guess field encodings', () => {
  it('ranks little-endian unsigned speed in hundredths above smaller fits', () => {
    const fits = guessEncodings(samples, 1, 2, { metric: 'speed', unit: 'km/h', min: 0, max: 20 });
    expect(fits[0]).toMatchObject({
      type: 'uint16',
      byteOrder: 'LE',
      scale: 0.01,
      unit: 'km/h',
      coverage: 1,
    });
  });

  it('returns no fit when fewer than 90 percent of the values match the requested range', () => {
    expect(
      guessEncodings(samples, 1, undefined, {
        metric: 'speed',
        unit: 'km/h',
        min: 1.234,
        max: 1.235,
      }),
    ).toEqual([]);
  });
});
