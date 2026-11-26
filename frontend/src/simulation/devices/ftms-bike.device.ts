import { uint16 } from '../bytes';
import type { ScriptedDevice } from '../scripted-device';
import type { SimulationState } from '../simulation-state';

function controlPoint(bytes: readonly number[], state: SimulationState) {
  const opCode = bytes[0] ?? 0xff;
  if (opCode === 0x00) state.values['control'] = 1;
  if (state.values['control'] !== 1) return { reply: [0x80, opCode, 0x05] };
  if (opCode === 0x04) {
    state.values['resistance'] = ((((bytes[1] ?? 0) | ((bytes[2] ?? 0) << 8)) << 16) >> 16) / 10;
  }
  return { reply: [0x80, opCode, [0x00, 0x01, 0x04, 0x08].includes(opCode) ? 0x01 : 0x02] };
}

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
          uuid: 0x2acc, // Fitness Machine Feature: cadence, resistance, power; resistance target
          properties: { read: true },
          read: () => [0x82, 0x40, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00],
        },
        {
          uuid: 0x2ad2, // Indoor Bike Data: speed, cadence (0.5 rpm), resistance and power (W)
          properties: { notify: true },
          notify: (state) => [
            ...uint16(0x0064),
            ...uint16(state.effort * 1000),
            ...uint16(state.effort * 60 * 2),
            ...uint16(state.values['resistance'] ?? 3),
            ...uint16(state.effort * 75),
          ],
        },
        {
          uuid: 0x2ad6, // Supported Resistance Range, in tenths of a level
          properties: { read: true },
          read: () => [...uint16(0), ...uint16(200), ...uint16(10)],
        },
        {
          uuid: 0x2ad9,
          properties: { write: true, indicate: true },
          onWrite: controlPoint,
        },
      ],
    },
  ],
};
