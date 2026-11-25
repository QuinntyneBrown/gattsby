import { canonicalUuid } from '../../knowledge-base/uuid';
import { FITNESS_MACHINE } from '../../tools/inspection/read-supported-ranges.tool';
import { decided, type RuleContext, type StageRule } from '../stage-rule';
import { decidedCandidate } from './identify.rules';

export const FITNESS_MACHINE_CONTROL_POINT = canonicalUuid(0x2ad9);

function canOfferControl(ctx: RuleContext): boolean {
  const { state, facts } = ctx;
  return (
    state.connected &&
    decidedCandidate(ctx)?.protocol === 'FTMS' &&
    facts.observations.some((observation) => observation.kind === 'metric-confirmed') &&
    (state.layout?.some(
      (service) =>
        service.uuid === FITNESS_MACHINE &&
        service.characteristics.some(
          (characteristic) =>
            characteristic.uuid === FITNESS_MACHINE_CONTROL_POINT &&
            characteristic.properties.includes('write') &&
            characteristic.properties.includes('indicate'),
        ),
    ) ??
      false)
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
];
