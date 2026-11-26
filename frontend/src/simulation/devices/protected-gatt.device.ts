import type { ScriptedDevice } from '../scripted-device';

export const PROTECTED_GATT: ScriptedDevice = {
  id: 'protected-gatt',
  name: 'Protected sensor',
  advertisedServices: [0x180a],
  services: [
    {
      uuid: 0x180a,
      characteristics: [
        {
          uuid: 0x2a29,
          properties: { read: true },
          read: () => {
            throw new DOMException('GATT Error: Insufficient Encryption.', 'NetworkError');
          },
        },
      ],
    },
  ],
};
