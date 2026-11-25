import { ascii } from '../bytes';
import type { ScriptedDevice } from '../scripted-device';
import { FTMS_BIKE } from './ftms-bike.device';

// An FTMS bike whose advertised name and maker are markup, for the render-untrusted-text design:
// both must be shown literally and run no script (NFR-013).
export const HOSTILE_NAME: ScriptedDevice = {
  ...FTMS_BIKE,
  id: 'hostile-name',
  name: '<img src=x onerror=alert(1)>',
  services: [
    ...FTMS_BIKE.services,
    {
      uuid: 0x180a,
      characteristics: [
        {
          uuid: 0x2a29,
          properties: { read: true },
          read: () => ascii('<script>alert(1)</script>'),
        },
      ],
    },
  ],
};
