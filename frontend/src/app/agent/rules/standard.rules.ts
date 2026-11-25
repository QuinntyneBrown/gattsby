import { canonicalUuid } from '../../knowledge-base/uuid';
import { decided, type RuleContext, type StageRule } from '../stage-rule';
import { decidedCandidate } from './identify.rules';

const STANDARD_PATHS = {
  treadmill: {
    characteristic: canonicalUuid(0x2acd),
    ready: 'Step on, press Start and walk slowly — around 3 km/h. Tap Ready when you’re walking.',
    action: 'Now speed up to about 6 km/h. Change only the speed.',
    followUp: 'Did the belt speed up?',
    notConfirmed: 'Speed not confirmed',
    metric: 'speed',
  },
  bike: {
    characteristic: canonicalUuid(0x2ad2),
    ready: 'Start pedalling at an easy pace. Tap Ready when you’re pedalling.',
    action: 'Now pedal faster.',
    followUp: 'Did you pedal faster?',
    notConfirmed: 'Speed not confirmed',
    metric: 'speed',
  },
  'heart-rate-sensor': {
    characteristic: canonicalUuid(0x2a37),
    ready: 'Put on the heart-rate strap. Tap Ready when it is fitted.',
    action: 'Walk briefly at an easy pace.',
    followUp: 'Were you able to walk?',
    notConfirmed: 'Heart rate not confirmed',
    metric: 'heartRate',
  },
} as const;

function standardPath(ctx: RuleContext) {
  if (!ctx.state.connected) return undefined;
  const profile = decidedCandidate(ctx);
  if (!profile || !profile.deviceType || !(profile.deviceType in STANDARD_PATHS)) {
    return undefined;
  }
  const path = STANDARD_PATHS[profile.deviceType as keyof typeof STANDARD_PATHS];
  const service = ctx.state.layout?.find(
    (service) =>
      service.uuid === profile.serviceUuid &&
      service.characteristics.some(
        (c) =>
          c.uuid === path.characteristic &&
          (c.properties.includes('notify') || c.properties.includes('indicate')),
      ),
  );
  return service ? { ...path, service: service.uuid } : undefined;
}

export const STANDARD_RULES: readonly StageRule[] = [
  {
    id: 'standard.ready',
    stage: 'standard',
    when: (ctx) => ctx.state.standardRecording === 'pending' && !!standardPath(ctx),
    then: (ctx) =>
      decided('standard.ready', 'standard', 'request_action', {
        instruction: standardPath(ctx)!.ready,
        needsReady: true,
        why: 'I need movement to see which numbers are live.',
      }),
  },
  {
    id: 'standard.record',
    stage: 'standard',
    when: (ctx) => ctx.state.standardRecording === 'ready' && !!standardPath(ctx),
    then: (ctx) => {
      const { characteristic } = standardPath(ctx)!;
      return decided('standard.record', 'standard', 'subscribe_and_record', {
        characteristics: [characteristic],
        seconds: 10,
        label: 'Baseline',
      });
    },
  },
  {
    id: 'standard.speed-action',
    stage: 'standard',
    when: (ctx) =>
      ctx.state.standardRecording === 'recorded' &&
      ctx.state.speedAction === null &&
      !!standardPath(ctx),
    then: (ctx) =>
      decided('standard.speed-action', 'standard', 'request_action', {
        instruction: standardPath(ctx)!.action,
        needsReady: false,
        confirmMetric: standardPath(ctx)!.metric,
        why: 'A rise in the live reading helps confirm the decoding.',
      }),
  },
  {
    id: 'standard.confirm-speed',
    stage: 'standard',
    when: (ctx) =>
      typeof ctx.state.speedAction === 'number' &&
      ctx.state.speedConfirmation === null &&
      ctx.state.standardRecordingId !== null &&
      !!standardPath(ctx),
    then: (ctx) =>
      decided('standard.confirm-speed', 'standard', 'decode_standard', {
        doneAt: ctx.state.speedAction,
        characteristic: standardPath(ctx)!.characteristic,
        recordingId: ctx.state.standardRecordingId,
      }),
  },
  {
    id: 'standard.speed-follow-up',
    stage: 'standard',
    when: (ctx) => ctx.state.speedConfirmation === 'notConfirmed' && !!standardPath(ctx),
    then: (ctx) =>
      decided('standard.speed-follow-up', 'standard', 'ask_user', {
        question: standardPath(ctx)!.followUp,
        sequence: standardPath(ctx)!.notConfirmed,
        detail:
          'The data didn’t show the expected change within 15 s. Your answer is saved with the readings.',
        answers: ['Yes', 'No'],
      }),
  },
  {
    id: 'standard.incline-action',
    stage: 'standard',
    when: ({ state }) =>
      state.connected &&
      state.speedConfirmation === 'confirmed' &&
      state.inclineAction === null &&
      state.inclineBaseline !== null &&
      state.inclineBaseline <= 1.5 &&
      state.machineFeatures.includes('Inclination'),
    then: () =>
      decided('standard.incline-action', 'standard', 'request_action', {
        instruction: 'Raise the incline to 2%, and keep the same speed.',
        needsReady: false,
        confirmMetric: 'incline',
        why: 'I’ll check that the decoded incline follows the console.',
      }),
  },
  {
    id: 'standard.confirm-incline',
    stage: 'standard',
    when: (ctx) =>
      typeof ctx.state.inclineAction === 'number' &&
      ctx.state.inclineConfirmation === null &&
      ctx.state.standardRecordingId !== null &&
      !!standardPath(ctx),
    then: (ctx) =>
      decided('standard.confirm-incline', 'standard', 'decode_standard', {
        doneAt: ctx.state.inclineAction,
        characteristic: standardPath(ctx)!.characteristic,
        recordingId: ctx.state.standardRecordingId,
      }),
  },
  {
    id: 'standard.incline-follow-up',
    stage: 'standard',
    when: ({ state }) => state.inclineConfirmation === 'notConfirmed',
    then: () =>
      decided('standard.incline-follow-up', 'standard', 'ask_user', {
        question: 'Does the console show 2% incline?',
        sequence: 'Incline not confirmed',
        detail:
          'The data didn’t show the expected change within 15 s. Your answer is saved with the readings.',
        answers: ['Yes', 'No'],
      }),
  },
];
