import { describe, expect, it } from 'vitest';
import { candidateDecodings } from './candidate-decodings';

describe('candidateDecodings (TOOL-011)', () => {
  it('reads one byte as uint8 and int8 only', () => {
    expect(candidateDecodings(Uint8Array.from([0xff]))).toEqual([
      { encoding: 'uint8', value: 255 },
      { encoding: 'int8', value: -1 },
    ]);
  });

  it('reads 16-bit values in both byte orders', () => {
    const encodings = candidateDecodings(Uint8Array.from([0x01, 0x02]));
    expect(encodings).toContainEqual({ encoding: 'uint16le', value: 0x0201 });
    expect(encodings).toContainEqual({ encoding: 'uint16be', value: 0x0102 });
  });

  it('adds UTF-8 text when every byte is printable', () => {
    expect(candidateDecodings(Uint8Array.from([0x48, 0x31, 0x30]))[0]).toEqual({
      encoding: 'utf8',
      value: 'H10',
    });
  });

  it('reads 32-bit values only from four bytes', () => {
    const encodings = candidateDecodings(Uint8Array.from([1, 0, 0, 0])).map((c) => c.encoding);
    expect(encodings).toContain('uint32le');
    expect(candidateDecodings(Uint8Array.from([1, 0, 0])).map((c) => c.encoding)).not.toContain(
      'uint32le',
    );
  });
});
