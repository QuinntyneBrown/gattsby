import { knownDataSubscriptions } from '../../agent/vendor-data-subscription';
import { toHex } from '../../ble/hex-codec';
import { ProtectedGattError } from '../../ble/protected-gatt-error';
import { PROPRIETARY_RECORDING_SECONDS } from '../../agent/proprietary-levels';
import { recordProtected } from '../protected-characteristic';
import type { ToolContext } from '../tool-context';
import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';

interface HandshakeInput {
  readonly vendor: string;
  readonly handshakeId: string;
}

export const replayKnownHandshakeTool = entry<HandshakeInput, unknown>({
  name: 'replay_known_handshake',
  group: 'Control',
  description: 'With approval, send a documented subscription that starts live vendor data.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['vendor', 'handshakeId'],
    properties: {
      vendor: { type: 'string', maxLength: 64 },
      handshakeId: { type: 'string', maxLength: 64 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'write',
  modelSelectable: false,
  preconditions: [],
  stages: ['proprietary'],
  requiredCapabilities: ['bluetooth'],
  phase: 'P2',
  labels: {
    running: () => 'Checking whether vendor data starts',
    purpose: () => 'Subscribe to the device’s documented live data',
    detail: 'Gattsby checks for live data after you approve the subscription.',
    card: true,
  },
  approval(input, ctx) {
    const { vendor, handshake, source } = resolveSubscription(input, ctx);
    const { deviceId, connectedAt } = ctx.ble.connection();
    if (!deviceId || connectedAt === null)
      throw new ToolError('NOT_CONNECTED', 'Connect to the device before sending a subscription.');
    return {
      tool: 'replay_known_handshake',
      title: `Send ${vendor.brand}’s data subscription?`,
      detail: handshake.purpose,
      risk: 'Starts reporting data for this connection only.',
      isMotion: false,
      sequence: 'Handshake',
      deviceId,
      connectedAt,
      service: handshake.service,
      characteristic: handshake.command,
      characteristicLabel: ctx.kb.nameOf(handshake.command) ?? handshake.command,
      expectedData: `Live packets on ${ctx.kb.nameOf(handshake.data) ?? handshake.data}`,
      sourceTitle: source.title,
      provenance: `handshake:${vendor.id}/${handshake.id}#1`,
      bytes: handshake.bytes,
    };
  },
  async run(input, ctx) {
    const approval = ctx.approval;
    if (!approval) return fail('APPROVAL_REQUIRED', 'This subscription needs approval.');
    const { vendor, handshake, source } = resolveSubscription(input, ctx);
    let complete!: (id: string | null) => void;
    const packet = new Promise<string | null>((resolve) => {
      complete = resolve;
    });
    const abort = (): void => complete(null);
    const disconnect = ctx.ble.disconnected.subscribe(abort);
    ctx.signal.addEventListener('abort', abort, { once: true });
    let stop: (() => Promise<void>) | undefined;
    let cancelTimer: (() => void) | undefined;
    let write: string | undefined;
    let pendingData: string | undefined;
    const followsWrite = (data: string, sent: string) =>
      Number(data.slice(2)) > Number(sent.slice(2));
    try {
      ctx.signal.throwIfAborted();
      stop = await ctx.ble.subscribe(handshake.service, handshake.data, ({ bytes, entryId }) => {
        if (
          bytes.length > handshake.dataPrefix.length &&
          handshake.dataPrefix.every((value, index) => value === bytes[index])
        ) {
          if (!write) pendingData = entryId;
          else if (followsWrite(entryId, write)) complete(entryId);
        }
        return undefined;
      });
      ctx.signal.throwIfAborted();
      const bytes = Uint8Array.from(handshake.bytes);
      write = await ctx.ble.write(handshake.service, handshake.command, bytes, approval.id);
      if (pendingData && followsWrite(pendingData, write)) complete(pendingData);
      cancelTimer = ctx.clock.setTimeout(abort, PROPRIETARY_RECORDING_SECONDS * 1_000);
      const data = await packet;
      ctx.signal.throwIfAborted();
      if (ctx.ble.connection().connectedAt !== approval.request.connectedAt)
        return fail('NOT_CONNECTED', 'The connection ended while waiting for data.', undefined, [
          write,
        ]);
      const sent = toHex(bytes);
      if (!data)
        return ok(
          'The subscription was sent. No data followed.',
          { sent: [sent], dataStarted: false },
          [write],
        );
      const observed = ctx.observe({
        kind: 'vendor-data-started',
        subject: handshake.data,
        value: handshake.id,
        text: `${vendor.brand} started reporting after the approved subscription.`,
        tag: 'confirmed',
        evidence: [write, data],
      });
      return ok(
        `${vendor.brand} started reporting.`,
        {
          sent: [sent],
          dataStarted: true,
          handshake: {
            vendor: vendor.brand,
            characteristic: handshake.command,
            bytes: sent,
            source: source.reference,
          },
        },
        [write, data, observed],
      );
    } catch (error) {
      if (error instanceof ProtectedGattError)
        return fail(
          'AUTH_REQUIRED',
          error.message,
          'The characteristic is protected.',
          recordProtected(ctx, error),
        );
      throw error;
    } finally {
      cancelTimer?.();
      disconnect.unsubscribe();
      ctx.signal.removeEventListener('abort', abort);
      await stop?.();
    }
  },
});

function resolveSubscription(input: HandshakeInput, ctx: ToolContext) {
  if (
    !ctx.kb.vendors.some(
      ({ id, handshakes }) =>
        id === input.vendor &&
        handshakes?.some(({ id: handshakeId }) => handshakeId === input.handshakeId),
    )
  )
    throw new ToolError(
      'INVALID_INPUT',
      'This data subscription is absent from the knowledge base.',
    );
  const target = knownDataSubscriptions(ctx.state, ctx.kb, ctx.verdictFacts().observations).find(
    ({ vendor, handshake }) => vendor.id === input.vendor && handshake.id === input.handshakeId,
  );
  if (
    !target ||
    ctx.state.proprietaryRecordings.idle?.status !== 'recorded' ||
    ctx.state.proprietaryRecordings.idle?.count !== 0
  )
    throw new ToolError(
      'PRECONDITION_FAILED',
      'The device has no eligible silent data subscription.',
    );
  return target;
}
