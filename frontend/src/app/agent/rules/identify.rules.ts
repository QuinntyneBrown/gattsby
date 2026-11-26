import { decide } from '../../knowledge-base/profile-matcher';
import { shortUuid } from '../../knowledge-base/uuid';
import { machineWord } from '../../tools/discovery/scan';
import {
  FITNESS_MACHINE,
  FITNESS_MACHINE_FEATURE,
  FTMS_RANGE_CHARACTERISTICS,
} from '../../tools/inspection/read-supported-ranges.tool';
import { decided, type RuleContext, type StageRule } from '../stage-rule';

const DEVICE_INFORMATION = '0000180a-0000-1000-8000-00805f9b34fb';
const MAX_CONNECTS = 3;
const MAX_HELD_PROMPTS = 2;

/** The decided profile, when the scores leave no doubt (FR-021). */
export function decidedCandidate({ state, config }: RuleContext) {
  if (!state.candidates) return null;
  if (state.selectedProtocol) {
    return (
      state.candidates.find((candidate) => candidate.protocol === state.selectedProtocol) ?? null
    );
  }
  const decision = decide(state.candidates, config.profileThreshold, config.profileMargin);
  return decision.kind === 'decided' ? decision.candidate : null;
}

function plausibleProtocols({ state, config }: RuleContext) {
  const candidates = state.candidates ?? [];
  const best = candidates[0]?.score ?? 0;
  const protocols = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    if (candidate.score < config.profileThreshold || best - candidate.score > config.profileMargin)
      continue;
    if (!protocols.has(candidate.protocol)) protocols.set(candidate.protocol, candidate);
  }
  return [...protocols.values()];
}

/** The next readable characteristic of the decided protocol's service that has a decoder. */
function nextFeatureRead(ctx: RuleContext): { service: string; characteristic: string } | null {
  const candidate = decidedCandidate(ctx);
  if (!candidate || !ctx.state.connected) return null;
  const service = ctx.state.layout?.find((s) => s.uuid === candidate.serviceUuid);
  const next = service?.characteristics.find(
    (c) =>
      c.properties.includes('read') &&
      !(
        service.uuid === FITNESS_MACHINE &&
        ctx.state.rangesAttempted &&
        FTMS_RANGE_CHARACTERISTICS.has(c.uuid)
      ) &&
      !!ctx.kb.decoderFor(c.uuid) &&
      !ctx.state.reads.includes(c.uuid),
  );
  return service && next ? { service: service.uuid, characteristic: next.uuid } : null;
}

// Identify: connect, list the layout, read Device Information, match the known profiles and read
// the decided protocol's feature characteristics (FR-015, FR-017, FR-019, FR-020, FR-021).
export const IDENTIFY_RULES: readonly StageRule[] = [
  {
    id: 'identify.connect',
    stage: 'identify',
    when: ({ state }) => !!state.device && !state.connected && state.connectAttempts === 0,
    then: ({ state }) =>
      decided('identify.connect', 'identify', 'connect', { deviceId: state.device!.deviceId }),
  },
  {
    id: 'identify.held-by-other',
    stage: 'identify',
    when: ({ state }) =>
      !state.connected &&
      state.connectFailures > state.heldPrompts &&
      state.heldPrompts < MAX_HELD_PROMPTS &&
      state.connectAttempts < MAX_CONNECTS,
    then: ({ state }) =>
      decided(
        'identify.held-by-other',
        'identify',
        'request_action',
        {
          title: 'Disconnect other apps and watches',
          instruction: 'Disconnect other apps and watches, then tap Done.',
          steps: [
            'Close the gym or console app on any phone nearby.',
            'Turn Bluetooth off on any watch paired with it.',
            `Still stuck? Switch the ${machineWord(state.machineType)} off and on.`,
          ],
          needsReady: false,
          stoppable: true,
        },
        {
          text: `Something else is probably connected to this ${machineWord(state.machineType)} — most machines only talk to one device at a time.`,
        },
      ),
  },
  {
    id: 'identify.reconnect',
    stage: 'identify',
    when: ({ state }) =>
      !!state.device &&
      !state.connected &&
      state.connectFailures > 0 &&
      state.heldPrompts === state.connectFailures &&
      state.connectAttempts < MAX_CONNECTS,
    then: ({ state }) =>
      decided('identify.reconnect', 'identify', 'connect', { deviceId: state.device!.deviceId }),
  },
  {
    id: 'identify.enumerate',
    stage: 'identify',
    when: ({ state }) => state.connected && state.layout === null,
    then: () => decided('identify.enumerate', 'identify', 'enumerate_gatt', {}),
  },
  {
    id: 'identify.device-info',
    stage: 'identify',
    when: ({ state }) =>
      state.connected &&
      state.deviceInfo === null &&
      !!state.layout?.some((s) => s.uuid === DEVICE_INFORMATION),
    then: ({ state, kb }) => {
      const standard = state.layout
        ?.map((s) => kb.service(s.uuid))
        .find((s) => !!s && s.profiles.length > 0);
      const text = standard
        ? `Good sign: ${standard.name}${standard.shortName !== standard.name ? ` (${standard.shortName})` : ''} is a published standard most apps already speak. Next I’ll read who made it.`
        : 'Next I’ll read who made it.';
      return decided('identify.device-info', 'identify', 'read_device_info', {}, { text });
    },
  },
  {
    id: 'identify.match',
    stage: 'identify',
    when: ({ state }) => state.layout !== null && state.candidates === null,
    then: () => decided('identify.match', 'identify', 'match_known_profiles', {}),
  },
  {
    id: 'identify.vendor-signature',
    stage: 'identify',
    when: ({ state }) =>
      state.connected &&
      state.layout !== null &&
      state.candidates?.length === 0 &&
      state.vendorMatches === null &&
      (!!state.device?.name || state.layout.length > 0),
    then: ({ state }) =>
      decided('identify.vendor-signature', 'identify', 'vendor_signature_lookup', {
        ...(state.device?.name ? { name: state.device.name.slice(0, 512) } : {}),
        uuids: state.layout!.map(({ uuid }) => uuid).slice(0, 512),
      }),
  },
  {
    id: 'identify.supported-ranges',
    stage: 'identify',
    when: (ctx) =>
      ctx.state.connected &&
      !ctx.state.rangesAttempted &&
      decidedCandidate(ctx)?.serviceUuid === FITNESS_MACHINE &&
      !!ctx.state.layout?.some(
        (s) =>
          s.uuid === FITNESS_MACHINE &&
          s.characteristics.some(
            (c) => c.uuid === FITNESS_MACHINE_FEATURE && c.properties.includes('read'),
          ),
      ),
    then: () => decided('identify.supported-ranges', 'identify', 'read_supported_ranges', {}),
  },
  {
    id: 'identify.read-features',
    stage: 'identify',
    when: (ctx) => nextFeatureRead(ctx) !== null,
    then: (ctx) =>
      decided('identify.read-features', 'identify', 'read_characteristic', nextFeatureRead(ctx)!),
  },
  {
    id: 'identify.ambiguous',
    stage: 'identify',
    when: (ctx) =>
      ctx.state.connected &&
      !ctx.state.ambiguityResolved &&
      decidedCandidate(ctx) === null &&
      plausibleProtocols(ctx).length > 1,
    then: (ctx) => ({
      kind: 'ambiguous',
      ruleId: 'identify.ambiguous',
      stage: 'identify',
      options: plausibleProtocols(ctx).map((candidate, index) => ({
        action: {
          tool: 'update_hypothesis',
          input: {
            protocol: candidate.protocol,
            proposedConfidence: candidate.score / 100,
            evidence: ctx.facts.observations
              .filter(
                (entry) => entry.kind === 'service' && entry.subject === candidate.serviceUuid,
              )
              .map((entry) => entry.id),
          },
          ruleId: 'identify.ambiguous',
          stage: 'identify' as const,
        },
        label: candidate.label,
        purpose: `Continue with ${candidate.protocol} using service ${shortUuid(candidate.serviceUuid)}.`,
        recommended: index === 0,
      })),
    }),
  },
];
