import type { ScriptedService } from './scripted-service';

// One simulated device (simulate-devices-and-model design): what it advertises, the GATT
// services it really has and how their values respond to the person's effort.
export interface ScriptedDevice {
  /** Stable id a chooser script names. */
  readonly id: string;
  /** The advertised name, or null for an unnamed device. */
  readonly name: string | null;
  readonly advertisedServices: readonly (number | string)[];
  readonly services: readonly ScriptedService[];
  /** How many connection attempts the device refuses before it accepts one. */
  readonly refusedConnections?: number;
}
