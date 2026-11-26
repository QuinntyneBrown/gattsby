import { canonicalUuid } from '../../knowledge-base/uuid';
import type { VendorMatch } from '../../knowledge-base/vendor-match';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

interface LookupInput {
  readonly name?: string;
  readonly uuids?: readonly string[];
  readonly manufacturerId?: number;
}

export const vendorSignatureLookupTool = entry<LookupInput, { matches: VendorMatch[] }>({
  name: 'vendor_signature_lookup',
  group: 'Analysis',
  description: 'Compare the name, UUIDs and manufacturer identifier with vendor signatures.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', maxLength: 512 },
      uuids: { type: 'array', maxItems: 512, items: { type: 'string' } },
      manufacturerId: { type: 'integer', minimum: 0, maximum: 65535 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['identify', 'proprietary'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Matching vendor signatures',
    purpose: () => 'Compare the device with known vendor signatures',
    card: true,
  },
  async run(input, ctx) {
    if (!input.name && !input.uuids?.length && input.manufacturerId === undefined)
      return fail('INVALID_INPUT', 'Provide a name, UUID or manufacturer identifier.');
    const uuids = new Set(input.uuids?.map(canonicalUuid));
    const matches = ctx.kb.vendors.flatMap((vendor): VendorMatch[] => {
      const byName = vendor.namePatterns.find(({ pattern }) =>
        input.name ? new RegExp(pattern, 'u').test(input.name) : false,
      );
      const byUuid = [...vendor.services, ...vendor.characteristics].find(({ uuid }) =>
        uuids.has(uuid),
      );
      const byManufacturer = vendor.manufacturerIds.find(({ id }) => id === input.manufacturerId);
      if (!byName && !byUuid && !byManufacturer) return [];
      const matchedOn: VendorMatch['matchedOn'] = [
        ...(byName ? (['name'] as const) : []),
        ...(byUuid ? (['uuid'] as const) : []),
        ...(byManufacturer ? (['manufacturerId'] as const) : []),
      ];
      const source = byUuid?.source ?? byName?.source ?? byManufacturer?.source ?? '';
      return [
        {
          vendor: vendor.id,
          matchedOn,
          score: Math.min(100, (byName ? 30 : 0) + (byUuid ? 70 : 0) + (byManufacturer ? 40 : 0)),
          hasDecoder: false,
          hasHandshake: !!vendor.handshakes?.length,
          source: vendor.sources?.[source]?.reference ?? '',
        },
      ];
    });
    matches.sort((a, b) => b.score - a.score);
    const evidence = matches.map(({ vendor, matchedOn }) => {
      const name = ctx.kb.vendors.find(({ id }) => id === vendor)?.brand ?? vendor;
      return ctx.observe({
        kind: 'vendor-signature',
        subject: vendor,
        value: matchedOn.join(', '),
        text: `${name} matched on ${matchedOn.join(', ')}.`,
        tag: 'likely',
        evidence: ctx
          .verdictFacts()
          .observations.filter(({ kind, subject }) => kind === 'service' && uuids.has(subject))
          .map(({ id }) => id),
      });
    });
    const brands = matches.map(
      ({ vendor }) => ctx.kb.vendors.find(({ id }) => id === vendor)?.brand,
    );
    return ok(
      brands.length ? `Matched ${brands.join(', ')}.` : 'No vendor signature matched.',
      { matches },
      evidence,
    );
  },
});
