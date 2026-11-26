import type { ChosenDevice } from '../../ble/chosen-device';
import { ScanOptionsBuilder } from '../../ble/scan-options-builder';
import type { ScanRequest } from '../../ble/scan-request';
import { shortUuid } from '../../knowledge-base/uuid';
import type { ToolContext } from '../tool-context';
import { ToolError } from '../tool-error';
import { fail, ok, type ToolResult } from '../tool-result';

export interface ScanSelection extends ChosenDevice {
  readonly mode: 'filtered' | 'acceptAll';
  readonly excludedAsBlocklisted: readonly string[];
}

export type ScanOutput = ScanSelection | { readonly candidateHelp: true };

export interface TapButton {
  readonly label: string;
  readonly mode: 'filtered' | 'acceptAll' | 'candidateHelp';
}

const MACHINE_WORDS: Readonly<Record<string, string>> = {
  treadmill: 'treadmill',
  bike: 'bike',
  rower: 'rower',
  'cross-trainer': 'cross-trainer',
  'heart-rate-sensor': 'sensor',
};

export function machineWord(machineType: string | null | undefined): string {
  return (machineType && MACHINE_WORDS[machineType]) || 'machine';
}

// The tap gate and the chooser, shared by scan_devices and scan_all_devices (scan-for-the-device
// design). The request is built before the prompt is shown, so nothing slow sits between the tap
// and `requestDevice`.
export async function scanBehindTap(
  ctx: ToolContext,
  prompt: { title: string; detail: string; skippable?: boolean },
  buttons: readonly TapButton[],
  machineType: string | null,
  brand: string | null,
): Promise<ToolResult<ScanOutput>> {
  const builder = new ScanOptionsBuilder(ctx.kb);
  const requests: Record<ScanRequest['mode'], ScanRequest> = {
    filtered: builder.filtered(machineType, brand),
    acceptAll: builder.acceptAll(),
  };
  const response = await ctx.prompts.post(
    {
      kind: 'tap',
      title: prompt.title,
      detail: prompt.detail,
      why: null,
      sequence: null,
      answers: buttons.map((b) => b.label),
      primary: buttons[0].label,
      steps: [],
      allowFreeText: false,
      needsReady: false,
      skippable: prompt.skippable ?? false,
      stoppable: false,
    },
    ctx.signal,
  );
  if (response.skipped) {
    const id = ctx.observe({
      kind: 'scan-skipped',
      subject: ctx.stage,
      value: 'skipped',
      text: 'The person skipped the chooser.',
      tag: 'confirmed',
      evidence: [],
    });
    return fail('USER_CANCELLED', 'The person skipped the chooser.', undefined, [id]);
  }
  const mode = buttons.find((b) => b.label === response.answer)?.mode;
  if (!mode) return fail('INVALID_INPUT', 'Choose one of the available steps.');
  if (mode === 'candidateHelp') {
    const id = ctx.observe({
      kind: 'candidate-help',
      subject: 'device-chooser',
      value: 'requested',
      text: 'The person said several names look alike.',
      tag: 'confirmed',
      evidence: [],
    });
    return ok('Several names look alike.', { candidateHelp: true }, [id]);
  }
  const request = requests[mode];
  const excluded = request.excludedAsBlocklisted;
  for (const uuid of excluded) {
    ctx.observe({
      kind: 'unreachable',
      subject: uuid,
      value: 'blocklisted',
      text: `${ctx.kb.nameOf(uuid) ?? shortUuid(uuid)} is on Chrome’s blocklist, so it can’t be reached`,
      tag: 'confirmed',
      evidence: [],
    });
  }
  try {
    const device = await ctx.ble.requestDevice(request);
    const id = ctx.observe({
      kind: 'chosen-device',
      subject: device.deviceId,
      value: device.name ?? '',
      text: `Chosen device: ${device.name ?? 'Unnamed device'}`,
      tag: 'confirmed',
      evidence: [],
    });
    return ok(
      `You picked ${device.name ?? 'an unnamed device'}.`,
      { ...device, mode, excludedAsBlocklisted: excluded },
      [id],
    );
  } catch (error) {
    if (error instanceof ToolError && error.code === 'USER_CANCELLED') {
      ctx.observe({
        kind: 'scan-cancelled',
        subject: mode,
        value: 'cancelled',
        text: 'The list was closed without choosing',
        tag: 'confirmed',
        evidence: [],
      });
      return fail(
        'USER_CANCELLED',
        error.message,
        'You closed the list without choosing, so your machine may not have been in it.',
      );
    }
    throw error;
  }
}
