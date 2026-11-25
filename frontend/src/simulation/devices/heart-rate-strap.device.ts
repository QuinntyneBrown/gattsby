import { ascii } from '../bytes';
import type { ScriptedDevice } from '../scripted-device';

// A Polar H10 chest strap: Heart Rate, Device Information and Battery services.
export const HEART_RATE_STRAP: ScriptedDevice = {
  id: 'heart-rate-strap',
  name: 'Polar H10 8A1C2D3E',
  advertisedServices: [0x180d],
  services: [
    {
      uuid: 0x180d,
      characteristics: [
        {
          uuid: 0x2a37, // Heart Rate Measurement, flags 0x00: uint8 BPM
          properties: { notify: true },
          notify: (state) => [0x00, 70 + 25 * state.effort],
        },
        { uuid: 0x2a38, properties: { read: true }, read: () => [0x01] }, // Body Sensor Location: chest
      ],
    },
    {
      uuid: 0x180a,
      characteristics: [
        { uuid: 0x2a29, properties: { read: true }, read: () => ascii('Polar Electro Oy') },
        { uuid: 0x2a24, properties: { read: true }, read: () => ascii('H10') },
      ],
    },
    {
      uuid: 0x180f,
      characteristics: [{ uuid: 0x2a19, properties: { read: true }, read: () => [87] }],
    },
  ],
};
