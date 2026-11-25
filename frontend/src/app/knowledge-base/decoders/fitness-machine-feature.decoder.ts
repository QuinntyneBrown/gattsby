import { DecodeError, type Decoder } from './decoder';

// Fitness Machine Feature (0x2ACC): two little-endian 32-bit fields, the machine's features and
// the targets it accepts (Fitness Machine Service 1.0, section 4.3).
const FEATURES = [
  'Average speed',
  'Cadence',
  'Total distance',
  'Inclination',
  'Elevation gain',
  'Pace',
  'Step count',
  'Resistance level',
  'Stride count',
  'Expended energy',
  'Heart rate',
  'Metabolic equivalent',
  'Elapsed time',
  'Remaining time',
  'Power',
  'Force on belt and power output',
  'User data retention',
];

const TARGETS = [
  'Speed',
  'Inclination',
  'Resistance',
  'Power',
  'Heart rate',
  'Targeted expended energy',
  'Targeted step number',
  'Targeted stride number',
  'Targeted distance',
  'Targeted training time',
  'Targeted time in two heart rate zones',
  'Targeted time in three heart rate zones',
  'Targeted time in five heart rate zones',
  'Indoor bike simulation',
  'Wheel circumference',
  'Spin down control',
  'Targeted cadence',
];

function bits(field: number, names: readonly string[]): string[] {
  return names.filter((_, bit) => (field & (1 << bit)) !== 0);
}

export const fitnessMachineFeatureDecoder: Decoder = {
  id: 'fitness-machine-feature',
  decode(bytes) {
    if (bytes.length !== 8) throw new DecodeError('Fitness Machine Feature is 8 bytes.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const features = bits(view.getUint32(0, true), FEATURES);
    const targets = bits(view.getUint32(4, true), TARGETS);
    const text = `Reports ${features.join(', ') || 'no optional fields'}; accepts targets for ${
      targets.join(', ') || 'nothing'
    }`;
    return { text, value: { features, targets } };
  },
};
