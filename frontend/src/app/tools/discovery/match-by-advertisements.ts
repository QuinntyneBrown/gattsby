import type { ChosenDevice } from '../../ble/chosen-device';
import type { AdvertisementSample } from '../../store/model/advertisement-sample';
import type { ToolContext } from '../tool-context';
import { waitForAdvertisements } from './advertisement-window';
import { findReturningCandidate } from './power-cycle-detector';
import { machineWord } from './scan';

const BASELINE_MS = 2_100;
const RETURN_MS = 1_750;
const WATCH_LIMIT_MS = 60_000;
const MAX_SAMPLES = 120;

export async function matchByAdvertisements(
  ctx: ToolContext,
  candidateIds?: readonly string[],
): Promise<{ device: ChosenDevice; evidence: readonly string[] } | null> {
  const reported = ctx.state.reportedCandidates ?? [];
  const names = new Set(reported.map((name) => name.toLowerCase()));
  const permitted = await ctx.ble.permittedDevices().catch(() => []);
  const devices = permitted
    .filter(({ deviceId, name }) =>
      candidateIds?.length
        ? candidateIds.includes(deviceId)
        : !names.size || names.has(name?.toLowerCase() ?? ''),
    )
    .slice(0, 8);
  if (devices.length < 2) return null;
  const ready = await ctx.prompts.post(
    {
      kind: 'tap',
      title: 'Watch the nearby candidates',
      detail: 'Gattsby will watch the devices you previously allowed in Chrome.',
      why: null,
      sequence: null,
      answers: ['Start watching'],
      primary: 'Start watching',
      steps: [],
      allowFreeText: false,
      needsReady: false,
      skippable: true,
      stoppable: false,
    },
    ctx.signal,
  );
  if (ready.skipped) return null;
  const watch = new AbortController();
  const stopTimer = ctx.clock.setTimeout(() => watch.abort(), WATCH_LIMIT_MS);
  const stop = () => watch.abort();
  ctx.signal.addEventListener('abort', stop, { once: true });
  if (ctx.signal.aborted) stop();
  const packets = new Map<string, AdvertisementSample[]>(
    devices.map(({ deviceId }) => [deviceId, []]),
  );
  try {
    const watching = ctx.ble.watchAdvertisements(
      [...packets.keys()],
      (sample) => {
        const rows = packets.get(sample.deviceId);
        if (rows && rows.length < MAX_SAMPLES) rows.push(sample);
      },
      watch.signal,
    );
    await Promise.race([
      watching,
      waitForAdvertisements(ctx.clock, 5_000, watch.signal).then(() => {
        throw new Error('The browser did not start the advertisement watch.');
      }),
    ]);
    await waitForAdvertisements(ctx.clock, BASELINE_MS, watch.signal);
    const askedAt = ctx.clock.now();
    const type = machineWord(ctx.state.machineType);
    const response = await ctx.prompts.post(
      {
        kind: 'action',
        title: `Turn the ${type} off and on`,
        detail: `Once it is stopped, turn the ${type} off for about 5 seconds, then on. Tap Done when it is back on.`,
        why: null,
        sequence: null,
        answers: ['Done'],
        primary: 'Done',
        steps: [],
        allowFreeText: false,
        needsReady: false,
        skippable: true,
        stoppable: false,
      },
      watch.signal,
    );
    if (response.skipped) return null;
    await waitForAdvertisements(ctx.clock, RETURN_MS, watch.signal);
    const match = findReturningCandidate(packets, askedAt, response.respondedAt);
    if (!match) return null;
    const device = devices.find(({ deviceId }) => deviceId === match.id)!;
    const latest = packets.get(device.deviceId)?.at(-1);
    return {
      device: { ...device, advertisedServices: latest?.serviceUuids ?? [] },
      evidence: match.evidence,
    };
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    return null;
  } finally {
    watch.abort();
    stopTimer();
    ctx.signal.removeEventListener('abort', stop);
  }
}
