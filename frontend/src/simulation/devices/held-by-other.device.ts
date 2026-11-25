import type { ScriptedDevice } from '../scripted-device';
import { FTMS_TREADMILL } from './ftms-treadmill.device';

// The mocks' treadmill while another app still holds it: Chrome's connection attempt is refused
// once, then succeeds after the person disconnects the other app (FR-017).
export const HELD_BY_OTHER: ScriptedDevice = {
  ...FTMS_TREADMILL,
  id: 'held-by-other',
  refusedConnections: 1,
};
