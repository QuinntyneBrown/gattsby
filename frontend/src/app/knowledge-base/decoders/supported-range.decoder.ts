import { DecodeError, type DecodedValue } from './decoder';

export function decodeSupportedRange(
  bytes: Uint8Array,
  metric: 'incline' | 'resistance' | 'heartRate' | 'power',
): DecodedValue {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isHeartRate = metric === 'heartRate';
  if (bytes.length !== (isHeartRate ? 3 : 6)) {
    throw new DecodeError('The supported range has the wrong length.');
  }
  const scale = metric === 'incline' || metric === 'resistance' ? 10 : 1;
  const min = isHeartRate ? view.getUint8(0) : view.getInt16(0, true) / scale;
  const max = isHeartRate ? view.getUint8(1) : view.getInt16(2, true) / scale;
  const increment = isHeartRate ? view.getUint8(2) : view.getUint16(4, true) / scale;
  const [label, unit] = {
    incline: ['Incline', ' %'],
    resistance: ['Resistance', ''],
    heartRate: ['Heart rate', ' BPM'],
    power: ['Power', ' W'],
  }[metric];
  return { value: { min, max, increment }, text: `${label} ${min}–${max}${unit} by ${increment}` };
}
