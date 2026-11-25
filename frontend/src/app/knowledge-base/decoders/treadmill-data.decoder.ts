import type { Decoder } from './decoder';
import { decodeFlagLayout, describeFlagLayout } from './flag-layout-decoder';

// Bluetooth SIG Fitness Machine Service 1.0.1, Treadmill Data, in flag-bit order.
const LAYOUT = [
  [{ metric: 'speed', label: 'Speed', unit: 'km/h', type: 'uint16', scale: 0.01 }],
  [{ metric: 'averageSpeed', label: 'Average speed', unit: 'km/h', type: 'uint16', scale: 0.01 }],
  [{ metric: 'distance', label: 'Distance', unit: 'm', type: 'uint24', scale: 1 }],
  [
    { metric: 'incline', label: 'Incline', unit: '%', type: 'sint16', scale: 0.1 },
    { metric: 'rampAngle', label: 'Ramp angle', unit: '°', type: 'sint16', scale: 0.1 },
  ],
  [
    {
      metric: 'positiveElevation',
      label: 'Positive elevation gain',
      unit: 'm',
      type: 'uint16',
      scale: 0.1,
    },
    {
      metric: 'negativeElevation',
      label: 'Negative elevation gain',
      unit: 'm',
      type: 'uint16',
      scale: 0.1,
    },
  ],
  [{ metric: 'pace', label: 'Pace', unit: 'km/min', type: 'uint8', scale: 0.1 }],
  [{ metric: 'averagePace', label: 'Average pace', unit: 'km/min', type: 'uint8', scale: 0.1 }],
  [
    { metric: 'totalEnergy', label: 'Total energy', unit: 'kcal', type: 'uint16', scale: 1 },
    { metric: 'energyPerHour', label: 'Energy per hour', unit: 'kcal/h', type: 'uint16', scale: 1 },
    {
      metric: 'energyPerMinute',
      label: 'Energy per minute',
      unit: 'kcal/min',
      type: 'uint8',
      scale: 1,
    },
  ],
  [{ metric: 'heartRate', label: 'Heart rate', unit: 'BPM', type: 'uint8', scale: 1 }],
  [
    {
      metric: 'metabolicEquivalent',
      label: 'Metabolic equivalent',
      unit: 'MET',
      type: 'uint8',
      scale: 0.1,
    },
  ],
  [{ metric: 'elapsed', label: 'Elapsed', unit: 's', type: 'uint16', scale: 1 }],
  [{ metric: 'remaining', label: 'Remaining', unit: 's', type: 'uint16', scale: 1 }],
  [
    { metric: 'force', label: 'Force on belt', unit: 'N', type: 'sint16', scale: 1 },
    { metric: 'power', label: 'Power', unit: 'W', type: 'sint16', scale: 1 },
  ],
] as const;

export const treadmillDataDecoder: Decoder = {
  id: 'treadmill-data',
  metricLayout: describeFlagLayout(LAYOUT),
  decode: (bytes) => decodeFlagLayout(bytes, LAYOUT),
};
