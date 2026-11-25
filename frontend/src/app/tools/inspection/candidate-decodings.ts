export interface CandidateDecoding {
  readonly encoding: string;
  readonly value: string | number;
}

const WIDTHS = [1, 2, 4] as const;

// Every plausible reading of a value (TOOL-011): UTF-8 text when every byte is printable, and
// unsigned and signed integers at 8, 16 and 32 bits in both byte orders, read from offset 0 at
// every width not above the length. Pure.
export function candidateDecodings(bytes: Uint8Array): CandidateDecoding[] {
  const out: CandidateDecoding[] = [];
  if (bytes.length > 0 && bytes.every((b) => b >= 0x20 && b < 0x7f)) {
    out.push({ encoding: 'utf8', value: new TextDecoder().decode(bytes) });
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const width of WIDTHS) {
    if (width > bytes.length) break;
    const bits = width * 8;
    for (const little of width === 1 ? [true] : [true, false]) {
      const order = width === 1 ? '' : little ? 'le' : 'be';
      const unsigned =
        width === 1
          ? view.getUint8(0)
          : width === 2
            ? view.getUint16(0, little)
            : view.getUint32(0, little);
      const signed =
        width === 1
          ? view.getInt8(0)
          : width === 2
            ? view.getInt16(0, little)
            : view.getInt32(0, little);
      out.push({ encoding: `uint${bits}${order}`, value: unsigned });
      out.push({ encoding: `int${bits}${order}`, value: signed });
    }
  }
  return out;
}
