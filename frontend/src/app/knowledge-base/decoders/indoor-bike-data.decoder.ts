import type { Decoder } from './decoder';
import { decodeFlagLayout } from './flag-layout-decoder';

const LAYOUT = [
  [{ metric: 'speed', label: 'Speed', unit: 'km/h', type: 'uint16', scale: 0.01 }],
  [{ metric: 'averageSpeed', label: 'Average speed', unit: 'km/h', type: 'uint16', scale: 0.01 }],
  [{ metric: 'cadence', label: 'Cadence', unit: 'rpm', type: 'uint16', scale: 0.5 }],
  [{ metric: 'averageCadence', label: 'Average cadence', unit: 'rpm', type: 'uint16', scale: 0.5 }],
  [{ metric: 'distance', label: 'Distance', unit: 'm', type: 'uint24', scale: 1 }],
  [{ metric: 'resistance', label: 'Resistance level', unit: '', type: 'sint16', scale: 1 }],
  [{ metric: 'power', label: 'Power', unit: 'W', type: 'sint16', scale: 1 }],
  [{ metric: 'averagePower', label: 'Average power', unit: 'W', type: 'sint16', scale: 1 }],
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
] as const;

export const indoorBikeDataDecoder: Decoder = {
  id: 'indoor-bike-data',
  decode: (bytes) => decodeFlagLayout(bytes, LAYOUT),
};
