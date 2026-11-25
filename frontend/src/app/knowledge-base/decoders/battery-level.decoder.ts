import { DecodeError, type Decoder } from './decoder';

/** Battery Level (0x2A19): one byte, a percentage from 0 to 100. */
export const batteryLevelDecoder: Decoder = {
  id: 'battery-level',
  decode(bytes) {
    if (bytes.length < 1 || bytes[0] > 100) throw new DecodeError('Battery Level is 0 to 100.');
    return { text: `${bytes[0]} %`, value: { percent: bytes[0] } };
  },
};
