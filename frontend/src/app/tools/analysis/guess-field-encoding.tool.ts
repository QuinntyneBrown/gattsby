import type { EncodingFit } from '../../analysis/encoding-fit';
import type { ExpectedRange } from '../../analysis/expected-range';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

interface GuessInput {
  readonly recordingId: string;
  readonly compareWithRecordingId?: string;
  readonly uuid: string;
  readonly offset: number;
  readonly width?: number;
  readonly expected: ExpectedRange;
}

export const guessFieldEncodingTool = entry<GuessInput, { fits: readonly EncodingFit[] }>({
  name: 'guess_field_encoding',
  group: 'Analysis',
  description: 'Test integer widths, byte order and scale against the expected metric range.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['recordingId', 'uuid', 'offset', 'expected'],
    properties: {
      recordingId: { type: 'string' },
      compareWithRecordingId: { type: 'string' },
      uuid: { type: 'string' },
      offset: { type: 'integer', minimum: 0, maximum: 511 },
      width: { type: 'integer', minimum: 1, maximum: 4 },
      expected: {
        type: 'object',
        additionalProperties: false,
        required: ['metric', 'unit', 'min', 'max'],
        properties: {
          metric: { type: 'string', minLength: 1, maxLength: 48 },
          unit: { type: 'string', minLength: 1, maxLength: 24 },
          min: { type: 'number' },
          max: { type: 'number' },
        },
      },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  requiredCapabilities: [],
  stages: ['proprietary'],
  phase: 'P2',
  labels: {
    running: () => 'Testing field encodings',
    purpose: () => 'Test how the field might be encoded',
    card: true,
  },
  async run(input, ctx) {
    const { offset, width, expected, uuid, recordingId, compareWithRecordingId } = input;
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 511 ||
      (width !== undefined && ![1, 2, 3, 4].includes(width)) ||
      !Number.isFinite(expected?.min) ||
      !Number.isFinite(expected?.max) ||
      expected.min >= expected.max
    )
      return fail('INVALID_INPUT', 'Choose a valid integer field and expected range.');
    const { loadRecordingSamples } = await import('./load-recording-samples');
    const { guessEncodings } = await import('../../analysis/field-encoding-guesser');
    const ids = [recordingId, ...(compareWithRecordingId ? [compareWithRecordingId] : [])];
    const captures = await loadRecordingSamples(ctx, ids);
    const packets = captures.map(({ packets }) => packets.filter((packet) => packet.uuid === uuid));
    if (packets.some((rows) => rows.every(({ bytes }) => bytes.length < offset + (width ?? 1))))
      return fail('INVALID_INPUT', 'The chosen field is outside the packets.');
    if (
      packets.some(
        (rows) => rows.filter(({ bytes }) => bytes.length >= offset + (width ?? 1)).length < 5,
      )
    )
      return fail('INSUFFICIENT_DATA', 'The field needs at least five values in each recording.');
    const alternatives = packets.map((rows) =>
      guessEncodings(
        rows.map(({ bytes }) => bytes),
        offset,
        width,
        expected,
      ),
    );
    const fits = alternatives[0].filter((fit) =>
      alternatives
        .slice(1)
        .every((group) =>
          group.some(
            (other) =>
              fit.type === other.type &&
              fit.byteOrder === other.byteOrder &&
              fit.scale === other.scale,
          ),
        ),
    );
    const best = fits[0];
    if (!best) return ok('No encoding fit the expected range.', { fits }, ids);
    const summary = `Offset ${offset}, ${best.type} ${best.byteOrder} ×${best.scale} ${best.unit}.`;
    const correlation = ctx
      .verdictFacts()
      .observations.filter(({ kind, subject }) => kind === 'field-correlation' && subject === uuid);
    const evidence = [
      ...ids,
      ...correlation.map(({ id }) => id),
      ...packets.map((rows) => rows[0].id),
    ];
    const id = ctx.observe({
      kind: 'candidate-encoding',
      subject: uuid,
      value: `${offset}/${best.type}/${best.byteOrder}/${best.scale}/${best.unit}`,
      text: `Candidate encoding: ${summary}`,
      tag: 'likely',
      evidence,
    });
    return ok(summary, { fits }, [id, ...evidence]);
  },
});
