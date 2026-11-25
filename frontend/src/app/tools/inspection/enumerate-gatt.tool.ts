import type { GattServiceInfo } from '../../ble/gatt-layout';
import { isSigUuid, shortUuid } from '../../knowledge-base/uuid';
import { entry } from '../tool-definition';
import { ok } from '../tool-result';

export interface EnumerateGattOutput {
  readonly services: readonly (GattServiceInfo & {
    readonly name?: string;
    readonly characteristics: readonly {
      readonly uuid: string;
      readonly name?: string;
      readonly properties: readonly string[];
    }[];
  })[];
  readonly requestedButUnreachable: readonly string[];
  readonly note: string;
}

const DEVICE_INFORMATION = '0000180a-0000-1000-8000-00805f9b34fb';

export const INVISIBILITY_NOTE =
  'Services outside Gattsby’s known list, and services on Chrome’s blocklist, are invisible to the browser.';

// enumerate_gatt (TOOL-009): every reachable primary service and characteristic, named from the
// knowledge base, with the invisibility note of FR-023.
export const enumerateGattTool = entry<Record<string, never>, EnumerateGattOutput>({
  name: 'enumerate_gatt',
  group: 'Inspection',
  description: 'List every reachable service and characteristic with its properties.',
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
  ],
  stages: ['identify'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Listing everything it exposes',
    purpose: () => 'List everything it exposes',
    detail: 'Read-only, takes a few seconds. Nothing for you to do.',
    card: true,
  },
  async run(_input, ctx) {
    const layout = await ctx.ble.primaryServices();
    const evidence: string[] = [];
    const services = layout.map((service) => {
      const name = ctx.kb.nameOf(service.uuid);
      evidence.push(
        ctx.observe({
          kind: 'service',
          subject: service.uuid,
          value: shortUuid(service.uuid),
          text: `${name ?? 'Vendor service'} (${shortUuid(service.uuid)})`,
          tag: name ? 'confirmed' : 'guess',
          evidence: [],
        }),
      );
      return {
        ...service,
        ...(name ? { name } : {}),
        characteristics: service.characteristics.map((c) => {
          const cName = ctx.kb.nameOf(c.uuid);
          return { ...c, ...(cName ? { name: cName } : {}) };
        }),
      };
    });
    const reachable = new Set(layout.map((s) => s.uuid));
    const requestedButUnreachable = [
      ...ctx.state.unreachable,
      ...(ctx.state.device?.advertisedServices ?? []).filter((uuid) => !reachable.has(uuid)),
    ];
    if (!reachable.has(DEVICE_INFORMATION)) {
      evidence.push(
        ctx.observe({
          kind: 'device-info-absent',
          subject: DEVICE_INFORMATION,
          value: 'absent',
          text: 'Device Information absent',
          tag: 'confirmed',
          evidence: [],
        }),
      );
    }
    const brand = ctx.state.brand;
    if (brand && !ctx.kb.vendors.some((v) => v.brand.toLowerCase() === brand.toLowerCase())) {
      // FR-023: a brand with no known UUIDs suggests services the browser cannot see.
      const answer = ctx.observe({
        kind: 'brand-without-uuids',
        subject: brand,
        value: 'unknown',
        text: `${brand} has no known vendor services, so some of its services may be invisible`,
        tag: 'guess',
        evidence: [],
      });
      evidence.push(
        ctx.raiseMissingTool({
          capabilityKey: `vendor-services:${brand.toLowerCase()}`,
          title: `Known services for ${brand}`,
          reason: `The knowledge base has no service UUIDs for ${brand}, so any vendor service it has is invisible to the browser.`,
          evidence: [answer],
        }),
      );
    }
    const standard = layout.filter((s) => isSigUuid(s.uuid) && ctx.kb.service(s.uuid)).length;
    const count = layout.length;
    return ok(
      `${count} ${count === 1 ? 'service' : 'services'}, ${standard} of them standard.`,
      { services, requestedButUnreachable, note: INVISIBILITY_NOTE },
      evidence,
    );
  },
});
