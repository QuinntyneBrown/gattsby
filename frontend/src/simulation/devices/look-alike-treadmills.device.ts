import { FTMS_TREADMILL } from './ftms-treadmill.device';

export const LOOK_ALIKE_TREADMILLS = [
  FTMS_TREADMILL,
  ...['77C0', '0B9E', '3D86'].map((suffix) => ({
    ...FTMS_TREADMILL,
    id: `ftms-treadmill-${suffix.toLowerCase()}`,
    name: `HZN-T202-${suffix}`,
  })),
];
