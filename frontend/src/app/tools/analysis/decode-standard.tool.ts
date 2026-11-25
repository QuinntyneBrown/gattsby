import { canonicalUuid } from '../../knowledge-base/uuid';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

interface DecodeStandardInput {
  readonly characteristic: string;
  readonly recordingId?: string;
  readonly hex?: string;
  readonly doneAt?: number;
}

export const decodeStandardTool = entry<DecodeStandardInput, unknown>({
  name: 'decode_standard',
  group: 'Analysis',
  description: 'Decode a standard payload or analyse the fields stored in a recording.',
  inputSchema: {
    type: 'object',
    required: ['characteristic'],
    oneOf: [{ required: ['hex'] }, { required: ['recordingId'] }],
    properties: {
      characteristic: { type: 'string' },
      recordingId: { type: 'string' },
      hex: { type: 'string', maxLength: 1536 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['standard'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Checking whether the reading changed',
    purpose: () => 'Compare the readings before and after your change',
    detail: 'Gattsby checks the readings for up to 15 seconds.',
    card: true,
  },
  async run(input, ctx) {
    if (
      typeof input.characteristic !== 'string' ||
      (typeof input.hex === 'string') === (typeof input.recordingId === 'string')
    ) {
      return fail('INVALID_INPUT', 'Give one characteristic and either its hex or a recording ID.');
    }
    const characteristic = canonicalUuid(input.characteristic);
    const decoder = ctx.kb.decoderFor(characteristic);
    if (!decoder) return fail('DECODE_ERROR', 'There is no decoder for this characteristic.');
    const { analyseStandardRecording, decodeFields, parseHex } =
      await import('./analyse-standard-recording');
    if (typeof input.hex === 'string') {
      const bytes = parseHex(input.hex);
      if (!bytes) return fail('INVALID_INPUT', 'The value is not valid hex.');
      try {
        const { fields, summary } = decodeFields(decoder, bytes);
        return ok(summary, { fields, errors: [] });
      } catch (error) {
        return fail('DECODE_ERROR', error instanceof Error ? error.message : 'Could not decode.');
      }
    }
    const recordingId = input.recordingId!;
    const rows = await ctx.recordedPackets(recordingId);
    if (!rows) return fail('INVALID_INPUT', 'That recording was not found.');
    const analysis = { recordingId, ...analyseStandardRecording(rows, characteristic, decoder) };
    if (input.doneAt === undefined) {
      return ok(`Decoded ${analysis.values.length} notifications.`, analysis, [recordingId]);
    }
    if (!Number.isFinite(input.doneAt)) return fail('INVALID_INPUT', 'The action time is missing.');
    const { metric, baseline, qualifying, startedAt, paceMatches, inclineBaseline } =
      await ctx.confirmationCheck.finish(input.doneAt, ctx.ble, ctx.signal);
    const confirmed = !!(baseline && qualifying && startedAt !== null);
    const confirmations = new Map(
      ctx.state.readableMetrics
        .filter((entry) => entry.status === 'confirmed')
        .map((entry) => [entry.metric, entry.evidence] as const),
    );
    const { label, unit, precision } = {
      speed: { label: 'Speed', unit: 'km/h', precision: 1 },
      incline: { label: 'Incline', unit: '%', precision: 1 },
      heartRate: { label: 'Heart rate', unit: 'BPM', precision: 0 },
    }[metric];
    const summary = confirmed
      ? `${label} went from ${baseline.value.toFixed(precision)} to ${qualifying.value.toFixed(precision)} ${unit} within ${Math.ceil((qualifying.t - startedAt) / 1000)} s.`
      : `${label} did not move enough to confirm it.`;
    const observation = ctx.observe({
      kind: confirmed ? 'metric-confirmed' : 'metricConfirmation',
      subject: metric,
      value: confirmed ? 'confirmed' : 'notConfirmed',
      text: confirmed ? `${label}: ${qualifying.value.toFixed(precision)} ${unit}` : summary,
      tag: confirmed ? 'confirmed' : 'likely',
      evidence: [baseline?.rawLogId, qualifying?.rawLogId].filter((id) => id !== undefined),
    });
    const evidence = [observation, recordingId];
    if (confirmed) {
      confirmations.set(metric, [observation, baseline.rawLogId, qualifying.rawLogId]);
    }
    for (const match of paceMatches) {
      const field = match.field;
      const refs = [match.baseline.rawLogId, match.rawLogId];
      const paceObservation = ctx.observe({
        kind: 'metric-confirmed',
        subject: field.metric,
        value: 'confirmed',
        text: `${field.label}: ${field.value.toFixed(field.scale < 1 ? 1 : 0)} ${field.unit}`,
        tag: 'confirmed',
        evidence: refs,
      });
      evidence.push(paceObservation);
      confirmations.set(field.metric, [paceObservation, ...refs]);
    }
    const { resolveReadableMetrics } = await import('../../outcome/readable-metric-resolver');
    const readableMetrics = resolveReadableMetrics(
      characteristic,
      rows,
      decoder.metricLayout ?? [],
      { names: ctx.state.machineFeatures, evidence: ctx.state.machineFeatureEvidence },
      confirmations,
    );
    return ok(
      summary,
      {
        recordingId,
        confirmed,
        statistics: analysis.statistics,
        errors: analysis.errors,
        inclineBaseline,
        readableMetrics,
      },
      evidence,
    );
  },
});
