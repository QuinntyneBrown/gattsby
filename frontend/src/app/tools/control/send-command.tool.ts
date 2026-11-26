import { conservativeTarget } from '../../agent/safety-limits';
import { encodeCommand } from '../../knowledge-base/command-encoder';
import type { ApprovalRequest } from '../../store/model/approval-request';
import type { ControlEffect } from '../../store/model/control-effect';
import type { ToolContext } from '../tool-context';
import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';

interface SendCommandInput {
  readonly command: 'setTargetSpeed' | 'setTargetResistance' | 'stop';
  readonly value?: number;
}

export const sendCommandTool = entry<SendCommandInput, unknown>({
  name: 'send_command',
  group: 'Control',
  description: 'Send one approved, conservative FTMS test command or stop the test.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['command'],
    properties: {
      command: { enum: ['setTargetSpeed', 'setTargetResistance', 'stop'] },
      value: { type: 'number' },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'control',
  modelSelectable: false,
  preconditions: [
    {
      id: 'controlGranted',
      check: (ctx) => {
        const connection = ctx.ble.connection();
        return (
          connection.status === 'connected' && connection.connectedAt === ctx.state.controlGrantedAt
        );
      },
      code: 'PRECONDITION_FAILED',
      message: 'The device has not granted control on this connection.',
    },
  ],
  stages: ['control'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Sending the approved command',
    purpose: (input) =>
      input.command === 'stop' ? 'Stop the control test' : 'Test one control command',
    card: true,
  },
  approval: prepareCommand,
  async run(input, ctx) {
    if (!ctx.approval) return fail('APPROVAL_REQUIRED', 'This command needs its own approval.');
    const request = ctx.approval.request;
    if (request.effect) {
      // A device can change while the approval is open. Send only if the same one-step
      // command still matches a fresh sample.
      const fresh = prepareCommand({ ...input, value: request.effect.to }, ctx);
      if (fresh.effect?.from !== request.effect.from) {
        return fail('UNSAFE_VALUE', 'The live value changed before this approval was used.');
      }
    }
    const sentAt = ctx.controlTelemetry.now();
    const { evidence, label, result, raw, sent } = await ctx.controlPoint.send(
      ctx.approval,
      ctx.signal,
    );
    const observation = ctx.observe({
      kind: 'control-command',
      subject: input.command,
      value: result,
      text: `${label} (${raw}).`,
      tag: 'confirmed',
      evidence,
    });
    const ids = [...evidence, observation];
    if (result !== 'success')
      return fail('DEVICE_REJECTED', label, `The device refused the command. ${label}.`, ids);
    return ok(
      `The device accepted the command (${raw}).`,
      {
        result,
        raw,
        sent,
        sentAt,
        effect: request.effect ?? null,
      },
      ids,
    );
  },
});

function prepareCommand(input: SendCommandInput, ctx: ToolContext): ApprovalRequest {
  const command = ctx.kb.command(input.command);
  const connection = ctx.ble.connection();
  if (!command || !connection.deviceId || connection.connectedAt === null)
    throw new ToolError('PRECONDITION_FAILED', 'This command needs a known connected device.');
  const request = {
    tool: 'send_command',
    deviceId: connection.deviceId,
    connectedAt: connection.connectedAt,
    service: command.service,
    characteristic: command.characteristic,
  };
  if (input.command === 'stop') {
    return {
      ...request,
      title:
        ctx.verdictFacts().hypothesis?.deviceType === 'treadmill'
          ? 'Stop the belt?'
          : 'Stop the test?',
      detail:
        'Send Stop to the device to end the test. Use the machine’s own stop if it keeps moving.',
      risk: 'Stops the machine',
      isMotion: false,
      sequence: 'Command 3 of 3',
      bytes: [...encodeCommand(command, input.value)],
    };
  }
  const metric = command.metric;
  const deviceType = ctx.verdictFacts().hypothesis?.deviceType;
  const limits = deviceType ? ctx.kb.safeLimits(deviceType) : undefined;
  if (!limits) {
    ctx.raiseMissingTool({
      capabilityKey: `control-limits:${deviceType ?? 'unknown'}`,
      title: 'Safe command limits for this machine',
      reason: 'The knowledge base does not have a conservative test command for this device type.',
      evidence: [],
    });
    throw new ToolError('UNSAFE_VALUE', 'There are no safe command limits for this device type.');
  }
  if (
    (metric !== 'speed' && metric !== 'resistance') ||
    !command.claim ||
    !ctx.state.targetSettingFeatures.includes(command.claim)
  ) {
    throw new ToolError('UNSAFE_VALUE', 'The machine has not reported support for this command.');
  }
  const range = ctx.state.supportedRanges[metric];
  const reading = ctx.controlTelemetry.latest(metric, connection.connectedAt);
  if (!range || !reading)
    throw new ToolError(
      'UNSAFE_VALUE',
      'A supported range and a recent live reading are required.',
    );
  const target = conservativeTarget(command, limits, range, reading.value, input.value);
  const effect: ControlEffect = {
    metric,
    from: reading.value,
    to: target.value,
    baselineId: reading.rawLogId,
  };
  return {
    ...request,
    effect,
    title:
      metric === 'speed'
        ? `Lower the target speed to ${target.value} km/h?`
        : `Raise the target resistance to ${target.value}?`,
    detail: 'Change the target by the smallest step supported by this machine.',
    risk: metric === 'speed' ? 'Lowers the belt speed one step' : 'Raises the resistance one step',
    isMotion: true,
    sequence: 'Command 2 of 3',
    bytes: [...target.bytes],
  };
}
