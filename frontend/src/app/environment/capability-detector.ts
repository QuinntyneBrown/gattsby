import type { Capabilities } from './capabilities';

// The contract pages and the `check_capabilities` tool depend on (check-capabilities design).
export abstract class CapabilityDetector {
  /** Never throws; a capability that cannot be checked is reported as unavailable. */
  abstract detect(): Promise<Capabilities>;
}
