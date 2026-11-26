import type { LabelledRecording } from '../../analysis/labelled-recording';
import { ToolError } from '../tool-error';
import type { ToolContext } from '../tool-context';
import { parseHex } from './analyse-standard-recording';

const MAX_PACKETS_PER_CHARACTERISTIC = 192;

export async function loadRecordingSamples(
  ctx: ToolContext,
  recordingIds: readonly string[],
): Promise<LabelledRecording[]> {
  const metadata = await ctx.recordings();
  const captures: LabelledRecording[] = [];
  for (const id of recordingIds) {
    ctx.signal.throwIfAborted();
    const recording = metadata.find((row) => row.id === id);
    if (!recording || recording.interrupted)
      throw new ToolError(
        'PRECONDITION_FAILED',
        'Choose a completed recording from this investigation.',
      );
    const raw = await ctx.recordedPackets(id, MAX_PACKETS_PER_CHARACTERISTIC);
    if (!raw) throw new ToolError('INSUFFICIENT_DATA', 'The recording could not be read.');
    captures.push({
      id,
      label: recording.label,
      characteristics: recording.characteristics,
      packets: raw.flatMap(({ id, uuid, hex }) => {
        const bytes = parseHex(hex);
        return bytes && uuid ? [{ id, uuid, bytes }] : [];
      }),
    });
  }
  return captures;
}
