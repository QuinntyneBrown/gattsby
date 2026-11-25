import type { ProfileCandidate } from '../../agent/profile-candidate';
import { matchProfiles } from '../../knowledge-base/profile-matcher';
import { entry } from '../tool-definition';
import { ok } from '../tool-result';

// match_known_profiles (TOOL-012): scores the layout, the name and Device Information against
// every knowledge-base profile, deterministically (FR-021).
export const matchKnownProfilesTool = entry<
  Record<string, never>,
  { candidates: ProfileCandidate[] }
>({
  name: 'match_known_profiles',
  group: 'Inspection',
  description: 'Score the device against every known profile.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [
    {
      id: 'layoutRead',
      check: (ctx) => ctx.state.layout !== null,
      code: 'PRECONDITION_FAILED',
      message: 'enumerate_gatt has not run.',
    },
  ],
  stages: ['identify'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Matching it against known profiles',
    purpose: () => 'Match it against known profiles',
    detail: 'Takes a moment. Nothing for you to do.',
    card: true,
  },
  async run(_input, ctx) {
    const info = ctx.state.deviceInfo;
    const candidates = matchProfiles(ctx.kb, {
      layout: ctx.state.layout ?? [],
      name: ctx.state.device?.name ?? null,
      deviceInfo: info && info !== 'absent' ? info : null,
    }).filter((c) => c.score > 0);
    const best = new Map<string, ProfileCandidate>();
    for (const c of candidates) if (!best.has(c.serviceUuid)) best.set(c.serviceUuid, c);
    const evidence = [...best.values()].map((c) =>
      ctx.observe({
        kind: 'profile-match',
        subject: c.serviceUuid,
        value: String(c.score),
        text: `${c.label}: ${c.score} of 100`,
        tag: c.score >= 90 ? 'confirmed' : c.score >= 50 ? 'likely' : 'guess',
        evidence: [],
      }),
    );
    const top = candidates[0];
    return ok(
      top ? `Best match: ${top.label}, ${top.score} of 100.` : 'No known profile matches.',
      { candidates },
      evidence,
    );
  },
});
