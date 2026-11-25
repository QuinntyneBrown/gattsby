import type { SimulationState } from './simulation-state';

export interface CharacteristicProperties {
  readonly read?: boolean;
  readonly write?: boolean;
  readonly writeWithoutResponse?: boolean;
  readonly notify?: boolean;
  readonly indicate?: boolean;
}

// The device's answer to a write: bytes to indicate or notify back, or a GATT error name.
export interface WriteResponse {
  readonly reply?: readonly number[];
  readonly error?: 'NotSupportedError' | 'NetworkError' | 'NotAllowedError';
}

export interface ScriptedCharacteristic {
  readonly uuid: number | string;
  readonly properties: CharacteristicProperties;
  /** The value a read returns. */
  readonly read?: (state: SimulationState) => readonly number[];
  /** The value sent at each interval while notifications are on. */
  readonly notify?: (state: SimulationState) => readonly number[];
  /** Defaults to one second. */
  readonly notificationIntervalMs?: number;
  /** How the device answers a write. */
  readonly onWrite?: (bytes: readonly number[], state: SimulationState) => WriteResponse;
}
