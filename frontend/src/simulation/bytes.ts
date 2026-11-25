// Little-endian encoders for scripted values.

export function uint16(value: number): number[] {
  const v = Math.round(value) & 0xffff;
  return [v & 0xff, v >> 8];
}

export function uint24(value: number): number[] {
  const v = Math.round(value) & 0xffffff;
  return [v & 0xff, (v >> 8) & 0xff, v >> 16];
}

export function ascii(text: string): number[] {
  return [...text].map((character) => character.charCodeAt(0) & 0x7f);
}
