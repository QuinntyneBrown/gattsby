import { toHex } from '../../ble/hex-codec';
import type { Decoder } from './decoder';

/** Identifiers read as hex: System ID and PnP ID. */
export const hexDecoder: Decoder = {
  id: 'hex',
  decode(bytes) {
    const text = toHex(bytes);
    return { text, value: text };
  },
};
