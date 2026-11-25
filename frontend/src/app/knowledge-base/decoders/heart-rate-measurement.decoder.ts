import type { DecodedMetric } from './decoded-metric';
import { DecodeError, type Decoder } from './decoder';

/** Heart Rate Service 1.0, section 3.1.1. Flags precede the measurement and optional fields. */
export const heartRateMeasurementDecoder: Decoder = {
  id: 'heart-rate-measurement',
  decode(bytes) {
    const flags = bytes[0] ?? 0;
    const wide = (flags & 1) !== 0;
    const energy = (flags & 8) !== 0;
    const rr = (flags & 16) !== 0;
    const rateEnd = wide ? 3 : 2;
    const rrStart = rateEnd + (energy ? 2 : 0);
    if (
      bytes.length < rrStart ||
      (rr && (bytes.length - rrStart < 2 || (bytes.length - rrStart) % 2 !== 0))
    ) {
      throw new DecodeError(
        'Heart Rate Measurement is shorter than its flags announce or ends in a partial RR interval.',
      );
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const rate = wide ? view.getUint16(1, true) : view.getUint8(1);
    const value: DecodedMetric[] = [
      {
        metric: 'heartRate',
        label: 'Heart rate',
        unit: 'BPM',
        value: rate,
        offset: 1,
        type: wide ? 'uint16' : 'uint8',
        scale: 1,
        flag: 0,
      },
    ];
    if (energy) {
      value.push({
        metric: 'energyExpended',
        label: 'Energy expended',
        unit: 'kJ',
        offset: rateEnd,
        value: view.getUint16(rateEnd, true),
        type: 'uint16',
        scale: 1,
        flag: 3,
      });
    }
    if (rr) {
      for (let offset = rrStart; offset < bytes.length; offset += 2) {
        value.push({
          metric: 'rrInterval',
          label: 'RR interval',
          unit: 's',
          offset,
          value: view.getUint16(offset, true) / 1024,
          type: 'uint16',
          scale: 1 / 1024,
          flag: 4,
        });
      }
    }
    return { value, text: `Heart rate ${rate} BPM` };
  },
};
