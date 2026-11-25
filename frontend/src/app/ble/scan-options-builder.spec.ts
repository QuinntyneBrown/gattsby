import { describe, expect, it } from 'vitest';
import { knowledgeBaseWith, realKnowledgeBase } from '../knowledge-base/knowledge-base.fixture';
import { canonicalUuid } from '../knowledge-base/uuid';
import { ScanOptionsBuilder } from './scan-options-builder';

const FTMS = canonicalUuid(0x1826);

describe('ScanOptionsBuilder (FR-011, FR-012, FR-067)', () => {
  it('filters on the fitness services and passes every known service as optional', () => {
    const kb = realKnowledgeBase();
    const { options, mode } = new ScanOptionsBuilder(kb).filtered(null, null);
    expect(mode).toBe('filtered');
    expect('filters' in options && options.filters).toContainEqual({ services: [FTMS] });
    expect(options.optionalServices).toEqual(kb.knownServiceUuids());
    expect(options.optionalServices).toContain(canonicalUuid(0x180a));
  });

  it('does not filter on Device Information or Battery', () => {
    const { options } = new ScanOptionsBuilder(realKnowledgeBase()).filtered(null, null);
    const filtered = ('filters' in options ? options.filters : []).flatMap((f) => f.services ?? []);
    expect(filtered).not.toContain(canonicalUuid(0x180a));
    expect(filtered).not.toContain(canonicalUuid(0x180f));
  });

  it('puts the machine type’s service first without removing a filter', () => {
    const builder = new ScanOptionsBuilder(realKnowledgeBase());
    const any = builder.filtered(null, null).options;
    const hr = builder.filtered('heart-rate-sensor', null).options;
    const filters = (o: RequestDeviceOptions) => ('filters' in o ? (o.filters ?? []) : []);
    expect(filters(hr)[0]).toEqual({ services: [canonicalUuid(0x180d)] });
    expect(filters(hr)).toHaveLength(filters(any).length);
  });

  it('accepts all devices with the same optional services', () => {
    const kb = realKnowledgeBase();
    const { options, mode } = new ScanOptionsBuilder(kb).acceptAll();
    expect(mode).toBe('acceptAll');
    expect(options).toEqual({ acceptAllDevices: true, optionalServices: kb.knownServiceUuids() });
  });

  it('passes a vendor’s service UUID as optional and its name prefix as a filter (FR-067 AC1)', () => {
    const vendorService = '0bf669f0-45f2-11e7-9598-0800200c9a66';
    const kb = knowledgeBaseWith({
      vendors: [
        {
          id: 'test-vendor',
          brand: 'Testco',
          machineTypes: ['bike'],
          services: [{ uuid: vendorService, name: 'Testco data' }],
          characteristics: [],
          namePatterns: [{ pattern: '^TST-', prefix: 'TST-' }],
          manufacturerIds: [],
        },
      ],
      knownServiceUuids: [vendorService],
    });
    const { options } = new ScanOptionsBuilder(kb).filtered('bike', 'Testco');
    expect(options.optionalServices).toContain(vendorService);
    expect('filters' in options && options.filters?.[0]).toEqual({ namePrefix: 'TST-' });
  });

  it('leaves out a blocklisted service and reports it as unreachable (FR-067 AC2)', () => {
    const hid = canonicalUuid(0x1812);
    const kb = knowledgeBaseWith({
      vendors: [
        {
          id: 'test-vendor',
          brand: 'Testco',
          machineTypes: [],
          services: [{ uuid: hid, name: 'Testco remote' }],
          characteristics: [],
          namePatterns: [],
          manufacturerIds: [],
        },
      ],
    });
    const request = new ScanOptionsBuilder(kb).filtered(null, null);
    expect(request.options.optionalServices).not.toContain(hid);
    expect(request.excludedAsBlocklisted).toEqual([hid]);
  });
});
