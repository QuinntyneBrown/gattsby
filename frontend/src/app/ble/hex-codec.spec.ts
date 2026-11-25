import { describe, expect, it } from 'vitest';
import { toHex } from './hex-codec';

describe('toHex', () => {
  it('formats bytes as spaced upper-case hex', () => {
    expect(toHex(Uint8Array.from([0x0c, 0x04, 0x2c, 0x01]))).toBe('0C 04 2C 01');
  });

  it('formats no bytes as an empty string', () => {
    expect(toHex(new Uint8Array())).toBe('');
  });
});
