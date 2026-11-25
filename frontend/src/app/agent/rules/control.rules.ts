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
];
