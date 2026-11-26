export const PROPRIETARY_LEVELS = ['idle', 'slow', 'fast'] as const;

export type ProprietaryLevel = (typeof PROPRIETARY_LEVELS)[number];

export const PROPRIETARY_RECORDING_SECONDS = 10;

const instructions: Readonly<Record<string, readonly [string, string, string]>> = {
  treadmill: ['Keep the belt stopped', 'Walk slowly', 'Walk a little faster'],
  bike: ['Keep the pedals still', 'Pedal at an easy pace', 'Pedal a little faster'],
  rower: ['Keep the rower idle', 'Row at an easy pace', 'Row a little faster'],
};

export function proprietaryInstruction(
  machineType: string | null | undefined,
  level: ProprietaryLevel,
): string {
  const actions = machineType && instructions[machineType];
  const fallback = [
    'Keep the device still',
    'Use the device at an easy pace',
    'Increase your effort a little',
  ];
  return `${(actions || fallback)[PROPRIETARY_LEVELS.indexOf(level)]}, then tap Ready`;
}
