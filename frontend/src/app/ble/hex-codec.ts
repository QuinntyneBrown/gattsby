const TABLE = Array.from({ length: 256 }, (_, i) => i.toString(16).toUpperCase().padStart(2, '0'));

/** Spaced upper-case hex, "0C 04 2C 01" (log-raw-traffic design). */
export function toHex(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += i === 0 ? TABLE[bytes[i]] : ` ${TABLE[bytes[i]]}`;
  return out;
}

/** The bytes of a DataView, copied, so a later notification cannot change them. */
export function bytesOf(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}
