import type { DecodedMetric } from './decoded-metric';
import { DecodeError, type DecodedValue } from './decoder';

type Field = Omit<DecodedMetric, 'offset' | 'value' | 'flag'>;

const WIDTH = { uint8: 1, uint16: 2, uint24: 3, sint16: 2 } as const;

/** The first flag is More Data: its field is present when the bit is clear. */
export function decodeFlagLayout(
  bytes: Uint8Array,
  layout: readonly (readonly Field[])[],
): DecodedValue {
  if (bytes.length < 2) throw new DecodeError('The notification is missing its flags.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint16(0, true);
  const fields = layout.flatMap((group, bit) => {
    const mask = 1 << bit;
    const present = bit === 0 ? !(flags & mask) : !!(flags & mask);
    return present ? group.map((field) => ({ ...field, flag: bit })) : [];
  });
  const length = fields.reduce((sum, field) => sum + WIDTH[field.type], 2);
  if (bytes.length < length) {
    throw new DecodeError(
      `The flags announce ${length} bytes but the notification has ${bytes.length}.`,
    );
  }
  let offset = 2;
  const value: DecodedMetric[] = fields.map((field) => {
    const decoded = {
      ...field,
      offset,
      value: read(view, field.type, offset) / (1 / field.scale),
    };
    offset += WIDTH[field.type];
    return decoded;
  });
  return {
    value,
    text: value.map((field) => `${field.label} ${field.value} ${field.unit}`).join(', '),
  };
}

function read(view: DataView, type: Field['type'], offset: number): number {
  switch (type) {
    case 'uint8':
      return view.getUint8(offset);
    case 'uint16':
      return view.getUint16(offset, true);
    case 'uint24':
      return view.getUint16(offset, true) + (view.getUint8(offset + 2) << 16);
    case 'sint16':
      return view.getInt16(offset, true);
  }
}
