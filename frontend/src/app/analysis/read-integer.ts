export function readInteger(
  bytes: Uint8Array,
  offset: number,
  width: number,
  order: 'LE' | 'BE',
  signed: boolean,
): number {
  let value = 0;
  for (let i = 0; i < width; i++) {
    const index = offset + (order === 'LE' ? width - 1 - i : i);
    value = value * 256 + bytes[index];
  }
  const range = 256 ** width;
  return signed && value >= range / 2 ? value - range : value;
}
