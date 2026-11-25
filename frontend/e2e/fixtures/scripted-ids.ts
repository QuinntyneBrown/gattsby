import { canonicalUuid } from '../../src/simulation/bluetooth-uuid';
import { FTMS_TREADMILL } from '../../src/simulation/devices/ftms-treadmill.device';

// Ids and UUIDs specs use to script and check the FTMS treadmill.
export const treadmill = {
  id: FTMS_TREADMILL.id,
  name: FTMS_TREADMILL.name,
  ftmsService: canonicalUuid(0x1826),
  treadmillData: canonicalUuid(0x2acd),
  controlPoint: canonicalUuid(0x2ad9),
} as const;

// The scripted devices journey 2 identifies, by id and advertised name.
export const devices = {
  treadmill: { id: 'ftms-treadmill', name: 'HZN-T202-4F1A' },
  bike: { id: 'ftms-bike', name: 'SB-7731' },
  strap: { id: 'heart-rate-strap', name: 'Polar H10 8A1C2D3E' },
  unknown: { id: 'unknown-services', name: 'PM5 430071234' },
  heldByOther: { id: 'held-by-other', name: 'HZN-T202-4F1A' },
  hostile: { id: 'hostile-name', name: '<img src=x onerror=alert(1)>' },
} as const;

/** The UUIDs of a few standard services and characteristics, canonical. */
export const uuids = {
  fitnessMachine: canonicalUuid(0x1826),
  deviceInformation: canonicalUuid(0x180a),
  heartRate: canonicalUuid(0x180d),
  battery: canonicalUuid(0x180f),
  cyclingPower: canonicalUuid(0x1818),
  cyclingSpeedCadence: canonicalUuid(0x1816),
  runningSpeedCadence: canonicalUuid(0x1814),
  humanInterfaceDevice: canonicalUuid(0x1812),
  manufacturerName: canonicalUuid(0x2a29),
  fitnessMachineFeature: canonicalUuid(0x2acc),
  supportedSpeedRange: canonicalUuid(0x2ad4),
} as const;
