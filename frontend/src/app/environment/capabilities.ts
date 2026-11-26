import type { ModelAvailability } from '../model/model-availability';
import type { CapabilityDiagnostic } from './capability-diagnostic';

// What this browser and platform can do: the output of `check_capabilities` (TOOL-001), with
// `bluetooth.blocked` and `storage.open` added by the check-capabilities design.
export interface Capabilities {
  readonly diagnostics?: readonly CapabilityDiagnostic[];
  readonly secureContext: boolean;
  readonly bluetooth: {
    readonly api: boolean;
    readonly adapterAvailable: boolean;
    readonly blocked: boolean;
  };
  readonly model: ModelAvailability;
  readonly watchAdvertisements: boolean;
  readonly requestLEScan: boolean;
  readonly getDevices: boolean;
  readonly camera: boolean;
  readonly storage: {
    readonly open: boolean;
    readonly persisted: boolean;
    readonly quotaBytes: number;
    readonly usageBytes: number;
  };
  readonly platform: {
    readonly os: string;
    readonly browser: string;
    readonly version: string;
    readonly mobile: boolean;
  };
}
