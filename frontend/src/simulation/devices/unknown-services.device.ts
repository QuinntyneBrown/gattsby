import { uint16 } from '../bytes';
import type { ScriptedDevice } from '../scripted-device';

// A device with only vendor services: a Concept2 RowErg monitor advertised as PM5 430071234.
// One field of its notifications follows the person's effort, so the proprietary path can find it.
const SERVICE = 'ce060030-43e5-11e4-916c-0800200c9a66';

export const UNKNOWN_SERVICES: ScriptedDevice = {
  id: 'unknown-services',
  name: 'PM5 430071234',
  advertisedServices: ['ce060000-43e5-11e4-916c-0800200c9a66'],
  services: [
    {
      uuid: SERVICE,
      characteristics: [
        {
          uuid: 'ce060031-43e5-11e4-916c-0800200c9a66',
          properties: { notify: true },
          notificationIntervalMs: 400,
          notify: (state) => {
            const frame = [0xa5, state.ticks & 0xff, ...uint16(state.effort * 150), 0x00];
            return [...frame, frame.reduce((sum, byte) => sum ^ byte, 0)];
          },
        },
        {
          uuid: 'ce060032-43e5-11e4-916c-0800200c9a66',
          properties: { read: true },
          read: () => [0x01, 0x00, 0x04, 0x30],
        },
      ],
    },
  ],
};
