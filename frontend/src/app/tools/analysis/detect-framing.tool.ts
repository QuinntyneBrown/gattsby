import type { FramingReport } from '../../analysis/framing-report';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const detectFramingTool = entry<{ recordingId: string; uuid: string }, FramingReport>({
  name: 'detect_framing',
  group: 'Analysis',
  description: 'Check captured packets for a header, length field, counter and checksum.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['recordingId', 'uuid'],
    properties: { recordingId: { type: 'string' }, uuid: { type: 'string' } },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  requiredCapabilities: [],
  stages: ['proprietary'],
  phase: 'P2',
  labels: {
    running: () => 'Checking packet framing',
    purpose: () => 'Find structure in the captured packets',
    card: true,
  },
  async run({ recordingId, uuid }, ctx) {
    const { loadRecordingSamples } = await import('./load-recording-samples');
    const { detectFraming } = await import('../../analysis/framing-detector');
    const [recording] = await loadRecordingSamples(ctx, [recordingId]);
    const packets = recording.packets.filter((packet) => packet.uuid === uuid);
    const report = detectFraming(packets.map(({ bytes }) => bytes));
    if (!report)
      return fail('INSUFFICIENT_DATA', 'At least 20 packets are needed to check framing.');
    const { header, length, counter, checksum } = report;
    const parts = [
      header && `header ${header.bytes}`,
      length && `length candidate at byte ${length.offset}`,
      counter && `counter at byte ${counter.offset}`,
      checksum?.algorithm,
    ].filter(Boolean);
    const evidence = [recordingId, packets[0].id, packets[packets.length - 1].id];
    if (!parts.length) return ok('No consistent framing was found.', report, evidence);
    const summary = `Framing candidates: ${parts.join(', ')}. Packet fit: ${Math.round(report.fit * 100)}%.`;
    const id = ctx.observe({
      kind: 'framing',
      subject: uuid,
      value: parts.join(', '),
      text: summary,
      tag: 'likely',
      evidence,
    });
    return ok(summary, report, [id, ...evidence]);
  },
});
