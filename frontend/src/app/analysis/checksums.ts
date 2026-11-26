export function sum8(bytes: Uint8Array): number {
  return bytes.reduce((sum, value) => sum + value, 0) & 0xff;
}

export function xor8(bytes: Uint8Array): number {
  return bytes.reduce((sum, value) => sum ^ value, 0);
}

export function crc8(bytes: Uint8Array): number {
  return crc(bytes, 8, 0x07, 0, false);
}

export function crc16Ccitt(bytes: Uint8Array): number {
  return crc(bytes, 16, 0x1021, 0xffff, false);
}

export function crc16Modbus(bytes: Uint8Array): number {
  return crc(bytes, 16, 0xa001, 0xffff, true);
}

export const CHECKSUMS = [
  { name: 'sum8', width: 1, calculate: sum8 },
  { name: 'xor8', width: 1, calculate: xor8 },
  { name: 'crc8', width: 1, calculate: crc8 },
  { name: 'crc16-ccitt', width: 2, calculate: crc16Ccitt },
  { name: 'crc16-modbus', width: 2, calculate: crc16Modbus },
] as const;

function crc(
  bytes: Uint8Array,
  width: 8 | 16,
  polynomial: number,
  initial: number,
  reflected: boolean,
): number {
  const mask = (1 << width) - 1;
  const highBit = 1 << (width - 1);
  let value = initial;
  for (const byte of bytes) {
    value ^= reflected ? byte : byte << (width - 8);
    for (let bit = 0; bit < 8; bit++) {
      const carry = reflected ? value & 1 : value & highBit;
      value = reflected ? value >>> 1 : (value << 1) & mask;
      if (carry) value ^= polynomial;
    }
  }
  return value;
}
