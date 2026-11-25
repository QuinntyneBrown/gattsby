import { FTMS_BIKE } from './devices/ftms-bike.device';
import { FTMS_TREADMILL } from './devices/ftms-treadmill.device';
import { HEART_RATE_STRAP } from './devices/heart-rate-strap.device';
import { UNKNOWN_SERVICES } from './devices/unknown-services.device';
import type { ScriptedDevice } from './scripted-device';

// Every scripted device, by id. A spec names the ones nearby and the one its chooser script picks.
export const SCRIPTED_DEVICES: Readonly<Record<string, ScriptedDevice>> = Object.fromEntries(
  [FTMS_TREADMILL, FTMS_BIKE, HEART_RATE_STRAP, UNKNOWN_SERVICES].map((device) => [
    device.id,
    device,
  ]),
);
