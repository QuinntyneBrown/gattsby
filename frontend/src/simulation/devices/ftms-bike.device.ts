import { uint16 } from '../bytes';
import type { ScriptedDevice } from '../scripted-device';

// The paused investigation of the mocks: a spin bike at Basic-Fit Roubaix, advertised as SB-7731,
// an FTMS indoor bike.
export const FTMS_BIKE: ScriptedDevice = {
  id: 'ftms-bike',
  name: 'SB-7731',
  advertisedServices: [0x1826],
  services: [
    {
      uuid: 0x1826,
      characteristics: [
        {
          uuid: 0x2acc, // Fitness Machine Feature: cadence, power; resistance target
          properties: { read: true },
          read: () => [0x02, 0x40, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00],
        },
        {
          uuid: 0x2ad2, // Indoor Bike Data, flags 0x0044: speed, cadence (0.5 rpm), power (W)
          properties: { notify: true },
          notify: (state) => [
            ...uint16(0x0044),
            ...uint16(state.effort * 1000),
            ...uint16(state.effort * 60 * 2),
            ...uint16(state.effort * 75),
          ],
        },
        {
          uuid: 0x2ad9,
          properties: { write: true, indicate: true },
          onWrite: (bytes) => ({
            reply: [0x80, bytes[0] ?? 0xff, bytes[0] === 0x00 ? 0x01 : 0x05],
          }),
        },
      ],
    },
  ],
};
