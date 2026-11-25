import type { DecisionState } from '../agent/decision-state';
import { canonicalUuid } from '../knowledge-base/uuid';
import type { DeviceProfile } from '../store/model/device-profile';
import type { Observation } from '../store/model/observation';
import type { Step } from '../store/model/step';

const CONTROL_POINT = canonicalUuid(0x2ad9);
const COMMANDS = [
  {
    claim: 'Speed',
    feature: 'setTargetSpeed',
    opCode: '0x02',
    key: 'speed',
    uuid: 0x2ad4,
    type: 'uint16',
    scale: 0.01,
    unit: 'km/h',
  },
  {
    claim: 'Inclination',
    feature: 'setTargetIncline',
    opCode: '0x03',
    key: 'incline',
    uuid: 0x2ad5,
    type: 'sint16',
    scale: 0.1,
    unit: '%',
  },
  {
    claim: 'Resistance',
    feature: 'setTargetResistance',
    opCode: '0x04',
    key: 'resistance',
    uuid: 0x2ad6,
    type: 'sint16',
    scale: 0.1,
    unit: 'level',
  },
  {
    claim: 'Power',
    feature: 'setTargetPower',
    opCode: '0x05',
    key: 'power',
    uuid: 0x2ad8,
    type: 'sint16',
    scale: 1,
    unit: 'W',
  },
] as const;

export function claimedFeatures(
  state: DecisionState,
  steps: readonly Step[],
  observations: readonly Observation[],
): DeviceProfile['features'] {
  const hasControlPoint = state.layout?.some((service) =>
    service.characteristics.some((entry) => entry.uuid === CONTROL_POINT),
  );
  if (!hasControlPoint) return [];
  const read = steps.find((step) => step.tool === 'read_supported_ranges' && step.result.ok);
  if (!read?.result.ok) return [];
  const data = read.result.data as {
    targetSettingFeatures: string[];
    ranges: Record<string, { min: number; max: number; increment: number }>;
  };
  return COMMANDS.filter(({ claim }) => data.targetSettingFeatures.includes(claim)).map((entry) => {
    const source = canonicalUuid(entry.uuid);
    const range = data.ranges[entry.key];
    const featureRead = canonicalUuid(0x2acc);
    const evidence = observations
      .filter((row) => row.stepN === read.n && [source, featureRead].includes(row.subject))
      .map((row) => row.id);
    return {
      feature: entry.feature,
      command: {
        characteristic: CONTROL_POINT,
        opCode: entry.opCode,
        parameter: { type: entry.type, scale: entry.scale, unit: entry.unit },
      },
      range: range ? { ...range, source } : null,
      test: null,
      status: 'claimedOnly',
      evidence: [read.id, ...evidence],
    };
  });
}
