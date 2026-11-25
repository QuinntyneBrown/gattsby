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
