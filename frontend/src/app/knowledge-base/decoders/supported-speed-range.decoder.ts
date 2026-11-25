import { DecodeError, type Decoder } from './decoder';

// Supported Speed Range (0x2AD4): minimum, maximum and increment, each uint16 in 0.01 km/h
// (Fitness Machine Service 1.0, section 4.12).
export const supportedSpeedRangeDecoder: Decoder = {
  id: 'supported-speed-range',
  decode(bytes) {
    if (bytes.length !== 6) throw new DecodeError('Supported Speed Range is 6 bytes.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const [min, max, step] = [0, 2, 4].map((offset) => view.getUint16(offset, true) / 100);
    return {
      text: `Speed ${min.toFixed(1)}–${max.toFixed(1)} km/h by ${step.toFixed(1)}`,
      value: { minKmh: min, maxKmh: max, incrementKmh: step },
    };
  },
};
