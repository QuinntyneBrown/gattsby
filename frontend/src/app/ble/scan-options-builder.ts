import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { ScanRequest } from './scan-request';

const DEVICE_TYPE_FOR_ANSWER: Readonly<Record<string, string>> = {
  treadmill: 'treadmill',
  bike: 'bike',
  rower: 'rower',
  'cross-trainer': 'cross-trainer',
  'heart-rate-sensor': 'heart-rate-sensor',
};

// Builds the `requestDevice` options from the knowledge base (FR-011, FR-012, FR-067). Pure.
export class ScanOptionsBuilder {
  constructor(private readonly kb: KnowledgeBaseIndex) {}

  filtered(machineType: string | null, brand: string | null): ScanRequest {
    const preferredType = machineType ? DEVICE_TYPE_FOR_ANSWER[machineType] : undefined;
    const services = this.kb.services
      .filter((s) => s.scanFilter && !this.kb.isBlocklisted(s.uuid, 'all'))
      .map((s) => ({
        uuid: s.uuid,
        first: !!preferredType && s.characteristics.some((c) => c.deviceType === preferredType),
      }));
    const prefixes = this.kb.namePrefixes().map((p) => ({
      prefix: p.prefix,
      first: !!brand && p.brand.toLowerCase() === brand.toLowerCase(),
    }));
    const filters: BluetoothLEScanFilter[] = [
      ...prefixes.filter((p) => p.first).map((p) => ({ namePrefix: p.prefix })),
      ...services.filter((s) => s.first).map((s) => ({ services: [s.uuid] })),
      ...services.filter((s) => !s.first).map((s) => ({ services: [s.uuid] })),
      ...prefixes.filter((p) => !p.first).map((p) => ({ namePrefix: p.prefix })),
    ];
    return {
      options: { filters, optionalServices: [...this.kb.knownServiceUuids()] },
      excludedAsBlocklisted: this.excluded(),
      mode: 'filtered',
    };
  }

  acceptAll(): ScanRequest {
    return {
      options: { acceptAllDevices: true, optionalServices: [...this.kb.knownServiceUuids()] },
      excludedAsBlocklisted: this.excluded(),
      mode: 'acceptAll',
    };
  }

  private excluded(): string[] {
    return this.kb.allServiceUuids().filter((uuid) => this.kb.isBlocklisted(uuid, 'all'));
  }
}
