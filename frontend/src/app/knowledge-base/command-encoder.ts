import { ToolError } from '../tools/tool-error';
import type { CommandDefinition } from './command-definition';

export function encodeCommand(command: CommandDefinition, value?: number): Uint8Array {
  if (value === undefined && command.fixedBytes)
    return Uint8Array.from([command.opCode, ...command.fixedBytes]);
  if (value === undefined || !command.parameter) throw unsafe();
  const signed = command.parameter.type === 'sint16';
  const unrounded = value / command.parameter.scale;
  const integer = Math.round(unrounded);
  if (
    !Number.isFinite(unrounded) ||
    Math.abs(integer - unrounded) > 1e-7 ||
    integer < (signed ? -32768 : 0) ||
    integer > (signed ? 32767 : 65535)
  )
    throw unsafe();
  const bytes = new Uint8Array(3);
  bytes[0] = command.opCode;
  new DataView(bytes.buffer).setUint16(1, integer, true);
  return bytes;
}

function unsafe(): ToolError {
  return new ToolError('UNSAFE_VALUE', 'The value does not match the command encoding.');
}
