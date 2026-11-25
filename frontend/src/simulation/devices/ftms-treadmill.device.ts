import { ascii, uint16, uint24 } from '../bytes';
import type { ScriptedDevice } from '../scripted-device';
import type { SimulationState } from '../simulation-state';

// The main investigation of the mocks: a Horizon T202 treadmill by Johnson Health Tech,
// advertised as HZN-T202-4F1A, with services 0x1826 0x180A 0x180D 0xFFF0.

function speedHundredths(state: SimulationState): number {
  return state.values['targetSpeed'] ?? state.effort * 300;
}

// Treadmill Data (0x2ACD), flags 0x040C: speed, total distance, inclination and ramp angle,
// elapsed time.
function treadmillData(state: SimulationState): number[] {
  const speed = speedHundredths(state);
  const distance = (state.values['distance'] ?? 0) + speed / 360;
  state.values['distance'] = distance;
  return [
    ...uint16(0x040c),
    ...uint16(speed),
    ...uint24(distance),
    ...uint16(Math.round((state.values['incline'] ?? 0) * 10)),
    0,
    0,
    ...uint16(state.ticks),
  ];
}

// Fitness Machine Control Point (0x2AD9): request control, then change one value at a time.
function controlPoint(bytes: readonly number[], state: SimulationState): { reply: number[] } {
  const opCode = bytes[0] ?? 0xff;
  const result = (code: number) => ({ reply: [0x80, opCode, code] });
  if (opCode === 0x00) {
    state.values['control'] = 1;
    return result(0x01);
  }
  if (state.values['control'] !== 1) {
    return result(0x05); // Control not permitted
  }
  switch (opCode) {
    case 0x01: // Reset
    case 0x07: // Start or resume
      return result(0x01);
    case 0x02: // Set target speed, uint16 in 0.01 km/h
      state.values['targetSpeed'] = (bytes[1] ?? 0) | ((bytes[2] ?? 0) << 8);
      return result(0x01);
    case 0x08: // Stop or pause
      state.values['targetSpeed'] = 0;
      return result(0x01);
    default:
      return result(0x02); // Op code not supported
  }
}

export const FTMS_TREADMILL: ScriptedDevice = {
  id: 'ftms-treadmill',
  name: 'HZN-T202-4F1A',
  advertisedServices: [0x1826],
  services: [
    {
      uuid: 0x1826,
      characteristics: [
        {
          uuid: 0x2acc, // Fitness Machine Feature
          properties: { read: true },
          read: () => [0x0c, 0x14, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00],
        },
        { uuid: 0x2acd, properties: { notify: true }, notify: treadmillData },
        {
          uuid: 0x2ad4, // Supported Speed Range: 0.8 to 16.0 km/h by 0.1
          properties: { read: true },
          read: () => [...uint16(80), ...uint16(1600), ...uint16(10)],
        },
        { uuid: 0x2ad9, properties: { write: true, indicate: true }, onWrite: controlPoint },
        { uuid: 0x2ada, properties: { notify: true } }, // Fitness Machine Status
      ],
    },
    {
      uuid: 0x180a,
      characteristics: [
        { uuid: 0x2a29, properties: { read: true }, read: () => ascii('Johnson Health Tech') },
        { uuid: 0x2a24, properties: { read: true }, read: () => ascii('T202') },
        { uuid: 0x2a26, properties: { read: true }, read: () => ascii('2.14.0') },
      ],
    },
    {
      uuid: 0x180d,
      characteristics: [
        {
          uuid: 0x2a37,
          properties: { notify: true },
          notify: (state) => [0x00, state.effort === 0 ? 0 : 80 + 20 * state.effort],
        },
      ],
    },
    {
      uuid: 0xfff0,
      characteristics: [
        {
          uuid: 0xfff1,
          properties: { notify: true },
          notify: (state) => [0xa5, state.ticks & 0xff, ...uint16(speedHundredths(state)), 0x5a],
        },
        { uuid: 0xfff2, properties: { write: true }, onWrite: () => ({}) },
      ],
    },
  ],
};
