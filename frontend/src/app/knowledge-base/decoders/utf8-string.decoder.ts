import type { Decoder } from './decoder';

/** UTF-8 text with trailing NUL bytes and whitespace removed (read-device-information design). */
export const utf8StringDecoder: Decoder = {
  id: 'utf8-string',
  decode(bytes) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/[\0\s]+$/u, '');
    return { text, value: text };
  },
};
