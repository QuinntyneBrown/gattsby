import type { DecisionState } from '../agent/decision-state';
import { hasFtmsControlPoint } from '../knowledge-base/ftms-control-point';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import { canonicalUuid } from '../knowledge-base/uuid';
import type { DeviceProfile } from '../store/model/device-profile';
import type { Observation } from '../store/model/observation';
import type { Step } from '../store/model/step';

const FEATURE_READ = canonicalUuid(0x2acc);

export function profileFeatures(
  kb: KnowledgeBaseIndex,
  state: DecisionState,
  steps: readonly Step[],
  observations: readonly Observation[],
): DeviceProfile['features'] {
  if (!hasFtmsControlPoint(state.layout)) return [];
  const read = steps.find((step) => step.tool === 'read_supported_ranges' && step.result.ok);
  if (!read) return [];
  const request = steps.find((step) => step.tool === 'request_control');
  const grantRefused = request?.result.ok && state.controlGrantedAt === null;
  const commandTest = steps.find((step) => step.ruleId === 'control.test');
  const effectCheck = steps.find((step) => step.tool === 'check_command_effect');
  const closingStop = steps.find((step) => step.ruleId === 'control.stop');
  const layoutRead = steps.find((step) => step.tool === 'enumerate_gatt');
  return kb.data.commands.flatMap((definition): DeviceProfile['features'] => {
    const { id, claim, metric, parameter, characteristic, opCode, rangeCharacteristic } =
      definition;
    const opcode = `0x${opCode.toString(16).toUpperCase().padStart(2, '0')}`;
    if (id === 'start' || id === 'stop') {
      return [
        {
          feature: id,
          command: { characteristic, opCode: opcode, parameter: null },
          range: null,
          test: null,
          status:
            grantRefused || (id === 'stop' && closingStop?.result.error?.code === 'DEVICE_REJECTED')
              ? 'refused'
              : 'claimedOnly',
          evidence: [
            layoutRead?.id ?? read.id,
            ...(grantRefused && request ? [request.id] : []),
            ...(id === 'stop' && closingStop ? [closingStop.id] : []),
          ],
        },
      ];
    }
    if (!claim || !metric || !parameter || !state.targetSettingFeatures.includes(claim)) return [];
    const range = state.supportedRanges[metric];
    const evidence = observations
      .filter(
        (row) => row.stepN === read.n && [rangeCharacteristic, FEATURE_READ].includes(row.subject),
      )
      .map((row) => row.id);
    const attempted = (commandTest?.input as { command?: string } | undefined)?.command === id;
    const tested = attempted ? state.controlTest : null;
    let status: DeviceProfile['features'][number]['status'] = 'claimedOnly';
    if (grantRefused || (attempted && commandTest?.result.error?.code === 'DEVICE_REJECTED'))
      status = 'refused';
    if (tested && state.controlEffectStatus === 'confirmed') status = 'confirmed';
    if (grantRefused && request) evidence.push(request.id);
    if (attempted && commandTest) evidence.push(commandTest.id);
    if (tested && effectCheck) evidence.push(effectCheck.id);
    return [
      {
        feature: id,
        command: {
          characteristic,
          opCode: opcode,
          parameter,
        },
        range: range && rangeCharacteristic ? { ...range, source: rangeCharacteristic } : null,
        test: tested
          ? { from: tested.from, to: tested.to, result: state.controlEffectStatus ?? 'notSeen' }
          : null,
        status,
        evidence: [read.id, ...evidence],
      },
    ];
  });
}
