import type { CommandDefinition } from '../knowledge-base/command-definition';
import { encodeCommand } from '../knowledge-base/command-encoder';
import type { ControlLimits } from '../knowledge-base/control-limits';
import type { SupportedRange } from '../knowledge-base/supported-range';
import { ToolError } from '../tools/tool-error';

export function conservativeTarget(
  command: CommandDefinition,
  limits: ControlLimits,
  range: SupportedRange,
  current: number,
  proposed?: number,
): { value: number; bytes: Uint8Array } {
  const { min, max, increment } = range;
  const signed = limits.direction;
  const grid = Math.round((current - min) / increment);
  const currentOnGrid = min + grid * increment;
  const value = Number((min + (grid + signed) * increment).toFixed(8));
  if (
    limits.command !== command.id ||
    ![min, max, increment, current, value].every(Number.isFinite) ||
    increment <= 0 ||
    increment > limits.maxStep ||
    Math.abs(currentOnGrid - current) > 1e-7 ||
    current < min ||
    current > max ||
    (command.metric === 'speed' && current <= 0) ||
    value <= limits.minValue ||
    value > limits.maxValue ||
    value < min ||
    value > max ||
    (proposed !== undefined && proposed !== value)
  ) {
    throw new ToolError(
      'UNSAFE_VALUE',
      'No conservative change matches the current reading and supported range.',
    );
  }
  return { value, bytes: encodeCommand(command, value) };
}
