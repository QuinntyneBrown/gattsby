import { DecodeError, type DecodedValue } from '../../knowledge-base/decoders/decoder';
import { decodeSupportedRange } from '../../knowledge-base/decoders/supported-range.decoder';
import { supportedSpeedRangeDecoder } from '../../knowledge-base/decoders/supported-speed-range.decoder';
import { canonicalUuid } from '../../knowledge-base/uuid';
import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';

export const FITNESS_MACHINE = canonicalUuid(0x1826);
export const FITNESS_MACHINE_FEATURE = canonicalUuid(0x2acc);
const RANGES = [
  ['speed', 0x2ad4],
  ['incline', 0x2ad5],
  ['resistance', 0x2ad6],
  ['heartRate', 0x2ad7],
  ['power', 0x2ad8],
] as const;

export const FTMS_RANGE_CHARACTERISTICS = new Set([
  FITNESS_MACHINE_FEATURE,
  ...RANGES.map(([, uuid]) => canonicalUuid(uuid)),
]);

export const readSupportedRangesTool = entry<Record<string, never>, unknown>({
  name: 'read_supported_ranges',
  group: 'Inspection',
  description: 'Read the Fitness Machine Feature and the ranges the device exposes.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [
    {
      id: 'connected',
      check: (ctx) => ctx.ble.connection().status === 'connected',
      code: 'NOT_CONNECTED',
      message: 'The device is not connected.',
    },
  ],
  stages: ['identify', 'standard'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Reading the fitness machine’s features and ranges',
    purpose: () => 'Read the fitness machine’s features and ranges',
    card: true,
  },
  async run(_input, ctx) {
    const layout = ctx.state.layout?.find((service) => service.uuid === FITNESS_MACHINE);
    const readable = new Set(
      layout?.characteristics.filter((c) => c.properties.includes('read')).map((c) => c.uuid),
    );
    if (!readable.has(FITNESS_MACHINE_FEATURE)) {
      return fail('PRECONDITION_FAILED', 'Fitness Machine Feature is not readable.');
    }
    const features = ctx.kb.decoderFor(FITNESS_MACHINE_FEATURE);
    if (!features) return fail('PRECONDITION_FAILED', 'Fitness Machine Feature has no decoder.');
    const summaries: string[] = [];
    const evidence: string[] = [];
    async function read(uuid: string, decode: (bytes: Uint8Array) => DecodedValue) {
      if (ctx.signal.aborted) throw new ToolError('ABORTED', 'The read was stopped.');
      const name = ctx.kb.nameOf(uuid) ?? uuid;
      try {
        const packet = await ctx.ble.read(FITNESS_MACHINE, uuid);
        evidence.push(packet.entryId);
        const decoded = decode(packet.bytes);
        summaries.push(decoded.text);
        ctx.observe({
          kind: 'decoded-value',
          subject: uuid,
          value: decoded.text,
          text: `${name}: ${decoded.text}`,
          tag: 'confirmed',
          evidence: [packet.entryId],
        });
        return decoded.value;
      } catch (error) {
        if (error instanceof ToolError && error.code === 'AUTH_REQUIRED') {
          ctx.raiseMissingTool({
            capabilityKey: `encrypted-read:${uuid}`,
            source: 'encrypted',
            title: `Read the protected ${name}`,
            reason: 'The device requires authentication or encryption.',
            evidence: [],
          });
        }
        throw error;
      }
    }
    let featureValues: { features: string[]; targets: string[] };
    try {
      featureValues = (await read(
        FITNESS_MACHINE_FEATURE,
        features.decode,
      )) as typeof featureValues;
    } catch (error) {
      if (error instanceof DecodeError) return fail('GATT_ERROR', error.message);
      throw error;
    }
    const ranges: Record<string, unknown> = {};
    const unavailable: string[] = [];
    for (const [metric, assigned] of RANGES) {
      const uuid = canonicalUuid(assigned);
      if (readable.has(uuid)) {
        try {
          ranges[metric] = await read(uuid, (bytes) =>
            metric === 'speed' ? speedRange(bytes) : decodeSupportedRange(bytes, metric),
          );
          continue;
        } catch (error) {
          if (error instanceof ToolError && error.code === 'ABORTED') throw error;
          if (!(error instanceof ToolError || error instanceof DecodeError)) throw error;
        }
      }
      unavailable.push(metric);
    }
    return ok(
      summaries.join('. '),
      {
        machineFeatures: featureValues.features,
        targetSettingFeatures: featureValues.targets,
        ranges,
        unavailable,
      },
      evidence,
    );
  },
});

function speedRange(bytes: Uint8Array): DecodedValue {
  const result = supportedSpeedRangeDecoder.decode(bytes);
  const { minKmh, maxKmh, incrementKmh } = result.value as {
    minKmh: number;
    maxKmh: number;
    incrementKmh: number;
  };
  return { text: result.text, value: { min: minKmh, max: maxKmh, increment: incrementKmh } };
}
