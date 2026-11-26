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

function recordingIds(ctx: RuleContext): string[] {
  return PROPRIETARY_LEVELS.flatMap((level) => {
    const id = ctx.state.proprietaryRecordings[level]?.id;
    return id ? [id] : [];
  });
}

function encodingInput({ state, kb, facts }: RuleContext) {
  const expected = kb.encodingRange(facts.hypothesis?.deviceType ?? state.machineType ?? '');
  const best = state.proprietaryRanking?.find(
    ({ correlation, accumulating }) => !accumulating && Math.abs(correlation) >= 0.9,
  );
  const slow = state.proprietaryRecordings.slow?.id;
  const fast = state.proprietaryRecordings.fast?.id;
  if (!best || !expected || !slow || !fast) return null;
  return {
    recordingId: fast,
    compareWithRecordingId: slow,
    uuid: best.uuid,
    offset: best.offset,
    width: best.width,
    expected,
  };
}

function framingInput(ctx: RuleContext) {
  const uuid =
    ctx.state.proprietaryRanking?.[0]?.uuid ??
    ctx.facts.observations.find(({ kind }) => kind === 'varying-field')?.subject ??
    proprietaryCharacteristics(ctx)[0];
  const recording = PROPRIETARY_LEVELS.map((level) => ctx.state.proprietaryRecordings[level]).find(
    (level) => level?.status === 'recorded' && (level.count ?? 0) >= 20,
  );
  return uuid && recording?.id ? { uuid, recordingId: recording.id } : null;
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
  {
    id: 'proprietary.compare',
    stage: 'proprietary',
    when: (ctx) =>
      !nextLevel(ctx) && !ctx.state.proprietaryCompared && recordingIds(ctx).length >= 2,
    then: (ctx) =>
      decided('proprietary.compare', 'proprietary', 'find_varying_bytes', {
        recordingIds: recordingIds(ctx),
      }),
  },
  {
    id: 'proprietary.rank',
    stage: 'proprietary',
    when: (ctx) =>
      ctx.state.proprietaryCompared &&
      ctx.state.proprietaryRanking === null &&
      recordingIds(ctx).length >= 3 &&
      ctx.facts.observations.some(({ kind }) => kind === 'varying-field'),
    then: (ctx) =>
      decided('proprietary.rank', 'proprietary', 'correlate_with_action', {
        recordingIds: recordingIds(ctx),
        order: [...PROPRIETARY_LEVELS],
      }),
  },
  {
    id: 'proprietary.guess',
    stage: 'proprietary',
    when: (ctx) => !ctx.state.proprietaryEncodingAttempted && !!encodingInput(ctx),
    then: (ctx) =>
      decided('proprietary.guess', 'proprietary', 'guess_field_encoding', encodingInput(ctx)!),
  },
  {
    id: 'proprietary.framing',
    stage: 'proprietary',
    when: (ctx) => !nextLevel(ctx) && !ctx.state.proprietaryFramingAttempted && !!framingInput(ctx),
    then: (ctx) =>
      decided('proprietary.framing', 'proprietary', 'detect_framing', framingInput(ctx)!),
  },
];
