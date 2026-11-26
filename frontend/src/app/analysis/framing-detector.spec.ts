import { describe, expect, it } from 'vitest';
import { crc8, crc16Ccitt, crc16Modbus, sum8, xor8 } from './checksums';
import { detectFraming } from './framing-detector';

describe('packet framing', () => {
  it('calculates each checksum variant', () => {
    const input = new TextEncoder().encode('123456789');
    expect([sum8, xor8, crc8, crc16Ccitt, crc16Modbus].map((fn) => fn(input))).toEqual([
      0xdd, 0x31, 0xf4, 0x29b1, 0x4b37,
    ]);
  });

  it('requires 20 packets and cannot infer checksums from identical data', () => {
    const packet = Uint8Array.of(0xf0, 4, 11, 0xff);
    expect(detectFraming(Array.from({ length: 19 }, () => packet))).toBeNull();
    expect(detectFraming(Array.from({ length: 20 }, () => packet))).toMatchObject({
      length: { ambiguous: true },
      checksum: undefined,
      counter: undefined,
    });
  });
});
