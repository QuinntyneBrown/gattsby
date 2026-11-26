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
            // Synthetic frames for testing. The single data field follows the scripted effort.
            const strokeRate =
              (state.effort === 0 ? 0 : state.effort === 1 ? 253 : 271) +
              (state.effort === 0 ? 0 : state.ticks % 7);
            const frame = [0xf0, state.ticks & 0xff, 0, 0x72, 0x55, ...uint16(strokeRate), 0x3c];
            if (state.ticks % 2) frame.push(0x21);
            frame[2] = frame.length + 1;
            return [...frame, frame.reduce((sum, byte) => sum + byte, 0) & 0xff];
          },
        },
        {
          uuid: 'ce060033-43e5-11e4-916c-0800200c9a66',
          properties: { notify: true },
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
