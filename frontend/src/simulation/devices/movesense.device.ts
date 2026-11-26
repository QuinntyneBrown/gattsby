import type { ScriptedDevice } from '../scripted-device';

export const MOVESENSE_SERVICE = '34802252-7185-4d5d-b431-630e7050e8f0';
export const MOVESENSE_COMMAND = '34800001-7185-4d5d-b431-630e7050e8f0';
export const MOVESENSE_DATA = '34800002-7185-4d5d-b431-630e7050e8f0';
export const MOVESENSE_SUBSCRIPTION = [1, 1, ...new TextEncoder().encode('/Meas/Acc/13')];

export const MOVESENSE: ScriptedDevice = {
  id: 'movesense-sensor',
  name: 'Movesense 000000000001',
  advertisedServices: [MOVESENSE_SERVICE],
  services: [
    {
      uuid: MOVESENSE_SERVICE,
      characteristics: [
        {
          uuid: MOVESENSE_COMMAND,
          properties: { write: true },
          onWrite: (bytes, state) => {
            if (
              bytes.length !== MOVESENSE_SUBSCRIPTION.length ||
              bytes.some((byte, i) => byte !== MOVESENSE_SUBSCRIPTION[i])
            )
              return { error: 'NotSupportedError' };
            state.values['streaming'] = 1;
            return {};
          },
        },
        {
          uuid: MOVESENSE_DATA,
          properties: { notify: true },
          notificationIntervalMs: 400,
          notify: (state) =>
            state.values['streaming'] ? [2, 1, state.effort + (state.ticks % 2)] : undefined,
        },
      ],
    },
  ],
};
