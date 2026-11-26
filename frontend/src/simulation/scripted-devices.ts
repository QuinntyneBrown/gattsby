import { FTMS_BIKE } from './devices/ftms-bike.device';
import { LOOK_ALIKE_TREADMILLS } from './devices/look-alike-treadmills.device';
import { HEART_RATE_STRAP } from './devices/heart-rate-strap.device';
import { HELD_BY_OTHER } from './devices/held-by-other.device';
import { HOSTILE_NAME } from './devices/hostile-name.device';
import { UNKNOWN_SERVICES } from './devices/unknown-services.device';
import type { ScriptedDevice } from './scripted-device';

// Every scripted device, by id. A spec names the ones nearby and the one its chooser script picks.
export const SCRIPTED_DEVICES: Readonly<Record<string, ScriptedDevice>> = Object.fromEntries(
  [
    ...LOOK_ALIKE_TREADMILLS,
    FTMS_BIKE,
    HEART_RATE_STRAP,
    UNKNOWN_SERVICES,
    HELD_BY_OTHER,
    HOSTILE_NAME,
  ].map((device) => [device.id, device]),
);
