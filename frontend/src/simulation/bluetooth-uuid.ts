// Canonical 128-bit UUIDs, as Web Bluetooth reports them. A 16-bit number expands on the
// Bluetooth base UUID; a few GATT names that the scripted devices use are mapped too.

const BASE_UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';

const NAMES: Readonly<Record<string, number>> = {
  fitness_machine: 0x1826,
  device_information: 0x180a,
  heart_rate: 0x180d,
  cycling_power: 0x1818,
  battery_service: 0x180f,
};

export function canonicalUuid(uuid: number | string): string {
  if (typeof uuid === 'number') {
    return `${uuid.toString(16).padStart(8, '0')}${BASE_UUID_SUFFIX}`;
  }
  const named = NAMES[uuid];
  if (named !== undefined) {
    return canonicalUuid(named);
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    return uuid;
  }
  throw new TypeError(`Invalid Service name: '${uuid}'.`);
}
