import type { DeviceInformation } from '../../agent/device-information';
import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';

const DEVICE_INFORMATION = '0000180a-0000-1000-8000-00805f9b34fb';

const LABELS: Readonly<Record<string, string>> = {
  manufacturer: 'maker',
  model: 'model',
  serial: 'serial number',
  hardware: 'hardware revision',
  firmware: 'firmware',
  software: 'software revision',
  systemId: 'system ID',
  pnpId: 'PnP ID',
};

// read_device_info (TOOL-010): the Device Information Service's fields that exist (FR-020).
export const readDeviceInfoTool = entry<Record<string, never>, DeviceInformation>({
  name: 'read_device_info',
  group: 'Inspection',
  description: 'Read the maker, model, serial number and revisions from Device Information.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [
    {
      id: 'connected',
      check: (ctx) => ctx.state.connected,
      code: 'NOT_CONNECTED',
      message: 'The device is not connected.',
    },
    {
      id: 'deviceInformationPresent',
      check: (ctx) => !!ctx.state.layout?.some((s) => s.uuid === DEVICE_INFORMATION),
      code: 'PRECONDITION_FAILED',
      message: 'The device has no Device Information service.',
    },
  ],
  stages: ['identify'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Reading the maker and model',
    purpose: () => 'Read the maker, model and firmware',
    detail: 'Read-only, takes about a second. Nothing for you to do.',
    card: true,
  },
  async run(_input, ctx) {
    const service = ctx.state.layout!.find((s) => s.uuid === DEVICE_INFORMATION)!;
    const info: Record<string, string> = {};
    const evidence: string[] = [];
    const hidden: string[] = [];
    const failed: string[] = [];
    for (const kbChar of ctx.kb.service(DEVICE_INFORMATION)?.characteristics ?? []) {
      const present = service.characteristics.some((c) => c.uuid === kbChar.uuid);
      const field = kbChar.field;
      if (!present || !field) continue;
      if (ctx.kb.isBlocklisted(kbChar.uuid, 'reads')) {
        hidden.push(field);
        continue;
      }
      try {
        const read = await ctx.ble.read(DEVICE_INFORMATION, kbChar.uuid);
        const value = ctx.kb.decoderFor(kbChar.uuid)?.decode(read.bytes).text ?? '';
        if (value === '') continue;
        info[field] = value;
        evidence.push(
          read.entryId,
          ctx.observe({
            kind: 'device-info',
            subject: field,
            value,
            text: `${capitalise(LABELS[field] ?? field)}: ${value}`,
            tag: 'confirmed',
            evidence: [read.entryId],
          }),
        );
      } catch (error) {
        if (error instanceof ToolError && error.code === 'NOT_CONNECTED') throw error;
        failed.push(field);
      }
    }
    const fields = Object.keys(info);
    if (fields.length === 0 && failed.length > 0) {
      return fail('GATT_ERROR', `The device refused every read (${failed.join(', ')}).`);
    }
    const said = fields.map((f) => `${LABELS[f]} ${info[f]}`).join(', ');
    const notes = [
      ...hidden.map((f) => `${LABELS[f]} BLOCKLISTED`),
      ...failed.map((f) => `${LABELS[f]} failed`),
    ];
    return ok(
      `${said ? capitalise(said) : 'No fields'}.${notes.length ? ` ${capitalise(notes.join(', '))}.` : ''}`,
      info as DeviceInformation,
      evidence,
    );
  },
});

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
