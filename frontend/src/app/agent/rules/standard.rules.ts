import { decided, type RuleContext, type StageRule } from '../stage-rule';
import { decidedCandidate } from './identify.rules';

const TREADMILL_DATA = '00002acd-0000-1000-8000-00805f9b34fb';

function treadmillData(ctx: RuleContext) {
  if (!ctx.state.connected) return undefined;
  const profile = decidedCandidate(ctx);
  if (profile?.deviceType !== 'treadmill') return undefined;
  return ctx.state.layout?.find(
    (service) =>
      service.uuid === profile.serviceUuid &&
      service.characteristics.some(
        (c) => c.uuid === TREADMILL_DATA && c.properties.includes('notify'),
      ),
  );
}

export const STANDARD_RULES: readonly StageRule[] = [
  {
    id: 'standard.ready',
    stage: 'standard',
    when: (ctx) => ctx.state.standardRecording === 'pending' && !!treadmillData(ctx),
    then: () =>
      decided('standard.ready', 'standard', 'request_action', {
        instruction:
          'Step on, press Start and walk slowly — around 3 km/h. Tap Ready when you’re walking.',
        needsReady: true,
        why: 'I need movement to see which numbers are live.',
      }),
  },
  {
    id: 'standard.record',
    stage: 'standard',
    when: (ctx) => ctx.state.standardRecording === 'ready' && !!treadmillData(ctx),
    then: (ctx) =>
      decided('standard.record', 'standard', 'subscribe_and_record', {
        service: treadmillData(ctx)!.uuid,
        characteristic: TREADMILL_DATA,
        seconds: 10,
      }),
  },
];
