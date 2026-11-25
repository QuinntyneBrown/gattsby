import type { Decoder } from './decoders/decoder';
import { DECODERS } from './decoders/decoder-registry';
import type {
  KbBlocklistEntry,
  KbCharacteristic,
  KbProfile,
  KbService,
  KbVendor,
  KnowledgeBaseData,
} from './knowledge-base-data';
import { canonicalUuid } from './uuid';

const BRAND_SUGGESTIONS = 5;

// The loaded knowledge base with its lookups. Pure: built from the generated data, so unit tests
// can build one from a fixture.
export class KnowledgeBaseIndex {
  private readonly characteristics = new Map<string, KbCharacteristic & { service: KbService }>();
  private readonly servicesByUuid = new Map<string, KbService>();
  private readonly vendorNames = new Map<string, string>();

  constructor(readonly data: KnowledgeBaseData) {
    for (const service of data.services) {
      this.servicesByUuid.set(service.uuid, service);
      for (const c of service.characteristics) this.characteristics.set(c.uuid, { ...c, service });
    }
    for (const vendor of data.vendors) {
      for (const s of vendor.services) this.vendorNames.set(s.uuid, s.name);
      for (const c of vendor.characteristics) if (c.name) this.vendorNames.set(c.uuid, c.name);
    }
  }

  get version(): string {
    return this.data.version;
  }

  get services(): readonly KbService[] {
    return this.data.services;
  }

  get vendors(): readonly KbVendor[] {
    return this.data.vendors;
  }

  get blocklist(): readonly KbBlocklistEntry[] {
    return this.data.blocklist;
  }

  /** Every standard and vendor service UUID, blocklisted ones included. */
  allServiceUuids(): string[] {
    return [
      ...this.data.services.map((s) => s.uuid),
      ...this.data.vendors.flatMap((v) => v.services.map((s) => s.uuid)),
    ];
  }

  /** Every known service UUID that Chrome's blocklist does not exclude (FR-067). */
  knownServiceUuids(): readonly string[] {
    return this.data.knownServiceUuids;
  }

  isBlocklisted(uuid: string, operation: 'all' | 'reads' | 'writes'): boolean {
    const id = canonicalUuid(uuid);
    return this.data.blocklist.some(
      (e) => e.uuid === id && (e.exclusion === 'all' || e.exclusion === operation),
    );
  }

  service(uuid: string): KbService | undefined {
    return this.servicesByUuid.get(canonicalUuid(uuid));
  }

  characteristic(uuid: string): (KbCharacteristic & { service: KbService }) | undefined {
    return this.characteristics.get(canonicalUuid(uuid));
  }

  nameOf(uuid: string): string | undefined {
    const id = canonicalUuid(uuid);
    return (
      this.servicesByUuid.get(id)?.name ??
      this.characteristics.get(id)?.name ??
      this.vendorNames.get(id)
    );
  }

  decoderFor(uuid: string): Decoder | undefined {
    const id = this.characteristic(uuid)?.decoder;
    return id ? DECODERS.get(id) : undefined;
  }

  profiles(): (KbProfile & { service: KbService })[] {
    return this.data.services.flatMap((service) =>
      service.profiles.map((p) => ({ ...p, service })),
    );
  }

  /** Name prefixes from the vendor signatures, for the scan filters. */
  namePrefixes(): { brand: string; prefix: string }[] {
    return this.data.vendors.flatMap((v) =>
      v.namePatterns.flatMap((p) => (p.prefix ? [{ brand: v.brand, prefix: p.prefix }] : [])),
    );
  }

  /** At most five brands for the Prepare stage's brand question (start-an-investigation design). */
  brandSuggestions(machineType: string | null): string[] {
    const type = machineType ?? 'unknown';
    const fromVendors = this.data.vendors
      .filter((v) => v.machineTypes.some((t) => t === type))
      .map((v) => v.brand);
    const listed = this.data.brandSuggestions[type] ?? this.data.brandSuggestions['unknown'] ?? [];
    return [...new Set([...fromVendors, ...listed])].slice(0, BRAND_SUGGESTIONS);
  }
}
