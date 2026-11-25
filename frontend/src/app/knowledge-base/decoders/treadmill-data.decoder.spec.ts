import { describe, expect, it } from 'vitest';
import { DecodeError } from './decoder';
import { treadmillDataDecoder } from './treadmill-data.decoder';

describe('Treadmill Data (FR-024)', () => {
  it('decodes scaled values and preserves each field’s byte offset', () => {
    const packet = Uint8Array.of(0x0c, 0x04, 0x2c, 0x01, 8, 0, 0, 0xf6, 0xff, 0, 0, 52, 0);
    expect(treadmillDataDecoder.decode(packet).value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'speed', value: 3, unit: 'km/h', offset: 2 }),
        expect.objectContaining({ metric: 'distance', value: 8, unit: 'm', offset: 4 }),
        expect.objectContaining({ metric: 'incline', value: -1, unit: '%', offset: 7 }),
        expect.objectContaining({ metric: 'elapsed', value: 52, unit: 's', offset: 11 }),
      ]),
    );
  });

  it('reads distance after the flags when More Data omits instantaneous speed', () => {
    expect(treadmillDataDecoder.decode(Uint8Array.of(5, 0, 1, 2, 3)).value).toEqual([
      expect.objectContaining({ metric: 'distance', value: 197121, offset: 2 }),
    ]);
  });

  it('rejects the whole notification when a flag announces a missing field', () => {
    expect(() => treadmillDataDecoder.decode(Uint8Array.of(4, 0, 44, 1, 8))).toThrow(DecodeError);
  });
});
