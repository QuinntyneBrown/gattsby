import type { GattServiceInfo } from '../ble/gatt-layout';
import { canonicalUuid } from './uuid';

export const FTMS_SERVICE = canonicalUuid(0x1826);
export const FTMS_CONTROL_POINT = canonicalUuid(0x2ad9);

export function hasFtmsControlPoint(layout: readonly GattServiceInfo[] | null): boolean {
  return (
    layout
      ?.find((service) => service.uuid === FTMS_SERVICE)
      ?.characteristics.some(
        ({ uuid, properties }) =>
          uuid === FTMS_CONTROL_POINT &&
          properties.includes('write') &&
          properties.includes('indicate'),
      ) ?? false
  );
}
