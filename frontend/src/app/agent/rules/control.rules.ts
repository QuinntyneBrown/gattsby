import { hasFtmsControlPoint } from '../../knowledge-base/ftms-control-point';
import { decided, type RuleContext, type StageRule } from '../stage-rule';
import { decidedCandidate } from './identify.rules';

function canOfferControl(ctx: RuleContext): boolean {
  const { state, facts } = ctx;
  return (
    state.connected &&
    decidedCandidate(ctx)?.protocol === 'FTMS' &&
    facts.observations.some((observation) => observation.kind === 'metric-confirmed') &&
    hasFtmsControlPoint(state.layout)
  );
}

export const CONTROL_RULES: readonly StageRule[] = [
  {
    id: 'control.offer',
    stage: 'control',
    when: (ctx) => ctx.state.controlChoice === null && canOfferControl(ctx),
    then: () =>
      decided('control.offer', 'control', 'ask_user', {
        question: 'Test control?',
        answers: ['Test control', 'Skip — finish read-only'],
        detail: 'Optional. I’ll ask before every single command.',
        optionalStage: true,
      }),
  },
  {
    id: 'control.request',
    stage: 'control',
    when: ({ state }) =>
      state.connected && state.controlChoice === 'test' && !state.controlRequested,
    then: () => decided('control.request', 'control', 'request_control', {}),
  },
  {
    id: 'control.test',
    stage: 'control',
    when: ({ state }) =>
      state.connected && state.controlGrantedAt !== null && !state.controlAttempted,
    then: ({ facts, kb }) => {
      const deviceType = facts.hypothesis?.deviceType;
      const limits = deviceType ? kb.safeLimits(deviceType) : undefined;
      return limits
        ? decided('control.test', 'control', 'send_command', { command: limits.command })
        : decided('control.test', 'control', 'request_missing_tool', {
            capability: 'Safe command limits for this machine',
            reason:
              'The knowledge base does not have a conservative test command for this device type.',
            evidence: facts.hypothesis?.evidence ?? [],
          });
    },
  },
  {
    id: 'control.confirm',
    stage: 'control',
    when: ({ state }) => state.connected && !!state.controlTest && state.controlAnswer === null,
    then: ({ state }) => {
      const test = state.controlTest!;
      const speed = test.metric === 'speed';
      return decided('control.confirm', 'control', 'ask_user', {
        question: speed ? `Does the console show ${test.to} km/h?` : 'Did the resistance change?',
        answers: [speed ? `Yes, ${test.to}` : 'Yes', 'No change'],
        detail: 'Gattsby is checking the live readings.',
      });
    },
  },
  {
    id: 'control.check',
    stage: 'control',
    when: ({ state }) =>
      !!state.controlTest && state.controlAnswer !== null && state.controlEffectStatus === null,
    then: () => decided('control.check', 'control', 'check_command_effect', {}),
  },
  {
    id: 'control.stop',
    stage: 'control',
    when: ({ state }) =>
      state.connected &&
      state.controlGrantedAt !== null &&
      !state.controlStopped &&
      (state.controlEffectStatus === 'confirmed' || state.controlEffectStatus === 'notSeen'),
    then: () => decided('control.stop', 'control', 'send_command', { command: 'stop' }),
  },
];
