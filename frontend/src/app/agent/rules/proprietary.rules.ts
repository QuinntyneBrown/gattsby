import { decided, type RuleContext, type StageRule } from '../stage-rule';
import {
  PROPRIETARY_LEVELS,
  PROPRIETARY_RECORDING_SECONDS,
  proprietaryInstruction,
} from '../proprietary-levels';
import { standardPath } from './standard.rules';

export function proprietaryCharacteristics({ state, kb }: RuleContext): string[] {
  const characteristics = (state.layout ?? []).flatMap(({ characteristics }) =>
    characteristics.filter(
      ({ properties }) => properties.includes('notify') || properties.includes('indicate'),
    ),
  );
  return [...new Set(characteristics.map(({ uuid }) => uuid))].sort(
    (left, right) => Number(!!kb.decoderFor(left)) - Number(!!kb.decoderFor(right)),
  );
}

function nextLevel({ state }: RuleContext) {
  return PROPRIETARY_LEVELS.find(
    (level) =>
      !state.proprietaryRecordings[level] || state.proprietaryRecordings[level]?.status === 'ready',
  );
}

function needsProprietary(ctx: RuleContext): boolean {
  return ctx.state.connected && !!ctx.state.layout && !standardPath(ctx);
}

export const PROPRIETARY_RULES: readonly StageRule[] = [
  {
    id: 'proprietary.record-level',
    stage: 'proprietary',
    when: (ctx) =>
      needsProprietary(ctx) && !!nextLevel(ctx) && proprietaryCharacteristics(ctx).length > 0,
    then: (ctx) => {
      const level = nextLevel(ctx)!;
      if (ctx.state.proprietaryRecordings[level]?.status === 'ready') {
        return decided(`proprietary.record.${level}`, 'proprietary', 'subscribe_and_record', {
          characteristics: proprietaryCharacteristics(ctx).slice(0, 8),
          seconds: PROPRIETARY_RECORDING_SECONDS,
          label: level,
          level: PROPRIETARY_LEVELS.indexOf(level),
        });
      }
      return decided(
        `proprietary.ready.${level}`,
        'proprietary',
        'request_action',
        {
          instruction: proprietaryInstruction(ctx.state.machineType, level),
          detail: `Recording starts when you tap Ready and runs for ${PROPRIETARY_RECORDING_SECONDS} s.`,
          needsReady: true,
        },
        level === 'idle'
          ? {
              text: 'There’s no standard protocol. I’ll record the device at rest and at two effort levels.',
            }
          : undefined,
      );
    },
  },
];
