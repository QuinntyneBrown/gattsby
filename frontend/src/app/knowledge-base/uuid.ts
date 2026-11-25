const BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';

/** Lowercase 128-bit form of a 16-bit number, a `0xNNNN` string or a 128-bit UUID. */
export function canonicalUuid(uuid: number | string): string {
  if (typeof uuid === 'number') return `${uuid.toString(16).padStart(8, '0')}${BASE_SUFFIX}`;
  const lower = uuid.toLowerCase();
  if (/^0x[0-9a-f]{4}$/.test(lower)) return `0000${lower.slice(2)}${BASE_SUFFIX}`;
  return lower;
}

/** `0x1826` for a UUID on the Bluetooth base, the full UUID otherwise. */
export function shortUuid(uuid: string): string {
  const lower = uuid.toLowerCase();
  if (lower.startsWith('0000') && lower.endsWith(BASE_SUFFIX)) {
    return `0x${lower.slice(4, 8).toUpperCase()}`;
  }
  return lower;
}

/** Whether the UUID is on the Bluetooth base, that is a 16-bit SIG-assigned number. */
export function isSigUuid(uuid: string): boolean {
  return uuid.toLowerCase().endsWith(BASE_SUFFIX) && uuid.startsWith('0000');
}
