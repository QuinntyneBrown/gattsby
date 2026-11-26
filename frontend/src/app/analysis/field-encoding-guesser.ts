import type { EncodingFit } from './encoding-fit';
import type { ExpectedRange } from './expected-range';
import { readInteger } from './read-integer';

const SCALES = [1, 0.1, 0.01, 0.001] as const;
const WIDTHS = [1, 2, 3, 4] as const;
const BYTE_ORDERS = ['LE', 'BE'] as const;

export function guessEncodings(
  packets: readonly Uint8Array[],
  offset: number,
  width: number | undefined,
  expected: ExpectedRange,
): EncodingFit[] {
  const { min, max, unit } = expected;
  const midpoint = (min + max) / 2;
  const fits: EncodingFit[] = [];
  for (const size of width ? [width] : WIDTHS) {
    const eligible = packets.filter((bytes) => offset + size <= bytes.length);
    if (eligible.length < 5) continue;
    for (const byteOrder of size === 1 ? (['LE'] as const) : BYTE_ORDERS) {
      for (const signed of [false, true]) {
        const numbers = eligible.map((bytes) =>
          readInteger(bytes, offset, size, byteOrder, signed),
        );
        for (const scale of SCALES) {
          const matched = numbers
            .map((value) => value * scale)
            .filter((value) => min <= value && value <= max);
          const coverage = matched.length / numbers.length;
          if (coverage < 0.9) continue;
          matched.sort((a, b) => a - b);
          const middle = Math.floor(matched.length / 2);
          fits.push({
            type: `${signed ? 'sint' : 'uint'}${size * 8}`,
            byteOrder,
            scale,
            unit,
            coverage,
            span: (matched[matched.length - 1] - matched[0]) / (max - min),
            median:
              matched.length % 2 ? matched[middle] : (matched[middle - 1] + matched[middle]) / 2,
            width: size,
          });
        }
      }
    }
  }
  return fits.sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.span - a.span ||
      Math.abs(a.median - midpoint) - Math.abs(b.median - midpoint) ||
      a.width - b.width ||
      Number(a.type.startsWith('s')) - Number(b.type.startsWith('s')) ||
      Number(a.byteOrder === 'BE') - Number(b.byteOrder === 'BE'),
  );
}
