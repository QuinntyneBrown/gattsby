import type { GattProperty } from '../knowledge-base/knowledge-base-data';

export interface GattCharacteristicInfo {
  readonly uuid: string;
  readonly properties: readonly GattProperty[];
}

export interface GattServiceInfo {
  readonly uuid: string;
  readonly characteristics: readonly GattCharacteristicInfo[];
  /** Set when the service's characteristics could not be listed. */
  readonly error?: string;
}
