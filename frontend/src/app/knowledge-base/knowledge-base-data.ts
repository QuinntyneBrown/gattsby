// The shape of the generated knowledge base (src/knowledge-base/generated/knowledge-base.json),
// written by scripts/validate-knowledge-base.ts. Every UUID is lowercase 128-bit.
import type { CommandDefinition } from './command-definition';
import type { ControlLimits } from './control-limits';
import type { VendorHandshake } from './vendor-handshake';
import type { ExpectedRange } from '../analysis/expected-range';

export type GattProperty = 'read' | 'write' | 'writeWithoutResponse' | 'notify' | 'indicate';

export type DeviceType =
  'treadmill' | 'bike' | 'rower' | 'cross-trainer' | 'heart-rate-sensor' | 'other';

export interface KbCharacteristic {
  readonly uuid: string;
  readonly name: string;
  readonly properties: readonly GattProperty[];
  readonly decoder?: string;
  readonly deviceType?: DeviceType;
  readonly field?: string;
}

export interface KbProfile {
  readonly id: string;
  readonly label: string;
  readonly deviceType: DeviceType;
  readonly requires: readonly string[];
  readonly expects: readonly string[];
}

export interface KbService {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly hypothesisLabel: string | null;
  readonly uuid: string;
  readonly scanFilter: boolean;
  readonly characteristics: readonly KbCharacteristic[];
  readonly profiles: readonly KbProfile[];
}

export interface KbVendor {
  readonly id: string;
  readonly brand: string;
  readonly machineTypes: readonly DeviceType[];
  readonly services: readonly { uuid: string; name: string; source?: string }[];
  readonly characteristics: readonly { uuid: string; name?: string; source?: string }[];
  readonly namePatterns: readonly { pattern: string; prefix?: string; source?: string }[];
  readonly manufacturerIds: readonly { id: number; source?: string }[];
  readonly sources?: Readonly<Record<string, { title: string; reference: string }>>;
  readonly handshakes?: readonly VendorHandshake[];
}

export interface KbBlocklistEntry {
  readonly uuid: string;
  readonly name: string;
  readonly exclusion: 'all' | 'reads' | 'writes';
}

export interface KnowledgeBaseData {
  readonly version: string;
  readonly schemaVersion: string;
  readonly contentHash: string;
  readonly services: readonly KbService[];
  readonly vendors: readonly KbVendor[];
  readonly commands: readonly CommandDefinition[];
  readonly controlLimits: Readonly<Record<string, ControlLimits>>;
  readonly blocklist: readonly KbBlocklistEntry[];
  readonly brandSuggestions: Readonly<Record<string, readonly string[]>>;
  readonly encodingRanges?: Readonly<Record<string, ExpectedRange>>;
  readonly knownServiceUuids: readonly string[];
}
