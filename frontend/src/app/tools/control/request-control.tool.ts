import { encodeCommand } from '../../knowledge-base/command-encoder';
import {
  FTMS_CONTROL_POINT,
  FTMS_SERVICE,
  hasFtmsControlPoint,
} from '../../knowledge-base/ftms-control-point';
import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';

export const requestControlTool = entry<Record<string, never>, unknown>({
  name: 'request_control',
  group: 'Control',
  description: 'Ask the FTMS device for control of the current connection.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'control',
  modelSelectable: false,
  preconditions: [
    {
      id: 'ftmsControlPoint',
      check: (ctx) =>
        ctx.ble.connection().status === 'connected' && hasFtmsControlPoint(ctx.state.layout),
      code: 'PRECONDITION_FAILED',
      message: 'There is no writable FTMS control point on this connection.',
    },
  ],
  stages: ['control'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Requesting control',
    purpose: () => 'Request control of this connection',
    card: true,
  },
  approval: (_input, ctx) => {
    const command = ctx.kb.command('requestControl');
    if (!command)
      throw new ToolError('UNSUPPORTED', 'Request Control is missing from the knowledge base.');
    return {
      tool: 'request_control',
      provenance: 'command:requestControl',
      title: 'Request control?',
      detail:
        'Ask this machine to let Gattsby send a command. This request does not move the device.',
      risk: 'No motion',
      isMotion: false,
      sequence: 'Command 1 of 3',
      deviceId: ctx.ble.connection().deviceId!,
      connectedAt: ctx.ble.connection().connectedAt!,
      service: FTMS_SERVICE,
      characteristic: FTMS_CONTROL_POINT,
      bytes: [...encodeCommand(command)],
    };
  },
  async run(_input, ctx) {
    if (!ctx.approval) return fail('APPROVAL_REQUIRED', 'Request Control needs its own approval.');
    const { evidence, label, result, raw } = await ctx.controlPoint.send(ctx.approval, ctx.signal);
    if (result === 'success') {
      ctx.signal.throwIfAborted();
      await ctx.controlPoint.watchPermission(ctx.state.layout, ctx.approval.request.connectedAt);
    }
    const id = ctx.observe({
      kind: result === 'success' ? 'control' : 'connection-quirk',
      subject: 'request_control',
      value: result,
      text: `Request Control: ${label}.`,
      tag: 'confirmed',
      evidence,
    });
    return ok(
      `Request Control: ${label} (${raw}).`,
      { result, raw, connectedAt: ctx.approval.request.connectedAt },
      [...evidence, id],
    );
  },
});
