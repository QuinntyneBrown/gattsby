import { toHex } from '../../ble/hex-codec';
import { DecodeError } from '../../knowledge-base/decoders/decoder';
import { shortUuid } from '../../knowledge-base/uuid';
import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';
import { candidateDecodings, type CandidateDecoding } from './candidate-decodings';

export interface ReadCharacteristicInput {
  readonly service: string;
  readonly characteristic: string;
}

export interface ReadCharacteristicOutput {
  readonly hex: string;
  readonly length: number;
  readonly candidates: readonly CandidateDecoding[];
  readonly knownDecoding?: string;
}

// read_characteristic (TOOL-011): one value in hex with its candidate decodings and the knowledge
// base's decoding where the UUID is known.
export const readCharacteristicTool = entry<ReadCharacteristicInput, ReadCharacteristicOutput>({
  name: 'read_characteristic',
  group: 'Inspection',
  description: 'Read one characteristic and list the ways its bytes could be read.',
  inputSchema: {
    type: 'object',
    required: ['service', 'characteristic'],
    properties: { service: { type: 'string' }, characteristic: { type: 'string' } },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  inputPrecondition: (input, state) => {
    const characteristic = state.layout
      ?.find((service) => service.uuid === input.service)
      ?.characteristics.find((entry) => entry.uuid === input.characteristic);
    if (!characteristic) return 'Choose a characteristic from the device’s discovered layout.';
    return characteristic.properties.includes('read')
      ? null
      : 'That characteristic cannot be read.';
  },
  preconditions: [
    {
      id: 'connected',
      check: (ctx) => ctx.state.connected,
      code: 'NOT_CONNECTED',
      message: 'The device is not connected.',
    },
  ],
  stages: ['identify', 'standard', 'proprietary'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: (i, { kb }) => `Reading ${nameOf(i.characteristic, kb.nameOf(i.characteristic))}`,
    purpose: (i, { kb }) => `Read ${nameOf(i.characteristic, kb.nameOf(i.characteristic))}`,
    detail: 'Read-only, takes about a second. Nothing for you to do.',
    card: true,
  },
  async run(input, ctx) {
    const layoutChar = ctx.state.layout
      ?.find((s) => s.uuid === input.service)
      ?.characteristics.find((c) => c.uuid === input.characteristic);
    if (layoutChar && !layoutChar.properties.includes('read')) {
      return fail('PROPERTY_MISSING', 'That characteristic cannot be read.');
    }
    const name = nameOf(input.characteristic, ctx.kb.nameOf(input.characteristic));
    let read;
    try {
      read = await ctx.ble.read(input.service, input.characteristic);
    } catch (error) {
      if (error instanceof ToolError && error.code === 'AUTH_REQUIRED') {
        const id = ctx.raiseMissingTool({
          capabilityKey: `encrypted-read:${input.characteristic}`,
          title: `Read the protected ${name}`,
          reason:
            'The device asks for authentication or encryption that Gattsby does not have, and Gattsby never tries to bypass it.',
          evidence: [],
        });
        return fail('AUTH_REQUIRED', error.message, `${name} is protected.`, [id]);
      }
      throw error;
    }
    const decoder = ctx.kb.decoderFor(input.characteristic);
    let knownDecoding: string | undefined;
    const evidence = [read.entryId];
    if (decoder) {
      try {
        knownDecoding = decoder.decode(read.bytes).text;
        evidence.push(
          ctx.observe({
            kind: 'decoded-value',
            subject: input.characteristic,
            value: knownDecoding,
            text: `${name}: ${knownDecoding}`,
            tag: 'confirmed',
            evidence: [read.entryId],
          }),
        );
      } catch (error) {
        if (!(error instanceof DecodeError)) throw error;
      }
    }
    return ok(
      knownDecoding ? `${name}: ${knownDecoding}.` : `${name}: ${toHex(read.bytes)}.`,
      {
        hex: toHex(read.bytes),
        length: read.bytes.length,
        candidates: candidateDecodings(read.bytes),
        ...(knownDecoding !== undefined ? { knownDecoding } : {}),
      },
      evidence,
    );
  },
});

function nameOf(uuid: string, known: string | undefined): string {
  return known ?? `characteristic ${shortUuid(uuid)}`;
}
