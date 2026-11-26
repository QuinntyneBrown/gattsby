import { inject, Injectable } from '@angular/core';
import { ConfirmationCheck } from '../../agent/confirmation-check';
import { PromptChannel } from '../../agent/prompt-channel';
import type { BleLayer } from '../../ble/ble-layer';
import type { DecodedMetric } from '../../knowledge-base/decoders/decoded-metric';
import type { Decoder } from '../../knowledge-base/decoders/decoder';
import type { NotificationDecoding } from '../../store/model/notification-decoding';
import { LiveMetrics } from '../../live/live-metrics';
import { Clock } from '../../shared/clock';
import type { RecordingSource } from './recording-source';
import type { RawLogEntry } from '../../store/model/raw-log-entry';

@Injectable()
export class NotificationRecorder {
  private readonly clock = inject(Clock);
  private readonly live = inject(LiveMetrics);
  private readonly confirmation = inject(ConfirmationCheck);
  private readonly prompts = inject(PromptChannel);

  async record(
    ble: BleLayer,
    sources: readonly RecordingSource[],
    recordingId: string,
    seconds: number,
    signal: AbortSignal,
    keepSubscriptions = true,
  ) {
    let count = 0;
    let decodeErrors = 0;
    let recording = false;
    let deadline = 0;
    const stops: (() => Promise<void>)[] = [];
    const byCharacteristic = sources.map(({ uuid }) => ({
      uuid,
      count: 0,
      lengths: new Set<number>(),
    }));
    try {
      for (const [index, { service, uuid, decoder }] of sources.entries()) {
        if (signal.aborted) break;
        const stats = byCharacteristic[index];
        stops.push(
          await ble.subscribe(service, uuid, ({ bytes, entryId, t }) => {
            if ((recording && signal.aborted) || this.prompts.idle()) return undefined;
            const inWindow = recording && t <= deadline;
            const capture = inWindow ? { recordingId } : {};
            if (inWindow) {
              count++;
              stats.count++;
              stats.lengths.add(bytes.length);
            }
            if (!decoder) return capture;
            const decoded = this.decode(decoder, uuid, bytes, entryId, t, inWindow);
            if (inWindow && decoded.decodeError) decodeErrors++;
            return { ...capture, ...decoded };
          }),
        );
      }
      const startedAt = this.clock.now();
      deadline = startedAt + seconds * 1000;
      recording = true;
      const interrupted = await this.wait(seconds, ble, signal);
      if (interrupted) this.confirmation.discardBaseline();
      if (signal.aborted || !keepSubscriptions) await Promise.all(stops.map((stop) => stop()));
      return {
        count,
        decodeErrors,
        startedAt,
        interrupted,
        perCharacteristic: byCharacteristic.map((stats) => ({
          uuid: stats.uuid,
          count: stats.count,
          lengths: [...stats.lengths].sort((a, b) => a - b),
          silent: stats.count === 0,
        })),
      };
    } catch (error) {
      await Promise.all(stops.map((stop) => stop()));
      throw error;
    } finally {
      recording = false;
    }
  }

  async restoreBaseline(
    ble: BleLayer,
    sources: readonly RecordingSource[],
    packets: readonly RawLogEntry[],
    signal: AbortSignal,
  ): Promise<void> {
    this.confirmation.discardBaseline();
    for (const packet of packets) {
      if (packet.decoded) this.confirmation.sample(packet.decoded, packet.id, packet.t, true);
    }
    for (const { service, uuid, decoder } of sources) {
      signal.throwIfAborted();
      if (!decoder) continue;
      await ble.subscribe(service, uuid, ({ bytes, entryId, t }) =>
        this.prompts.idle() ? undefined : this.decode(decoder, uuid, bytes, entryId, t, false),
      );
    }
  }

  private decode(
    decoder: Decoder,
    uuid: string,
    bytes: Uint8Array,
    entryId: string,
    at: number,
    inWindow: boolean,
  ): NotificationDecoding {
    try {
      const fields = decoder.decode(bytes).value;
      if (!Array.isArray(fields)) return {};
      const metrics = fields as readonly DecodedMetric[];
      this.live.update(metrics, uuid, at);
      this.confirmation.sample(metrics, entryId, at, inWindow);
      return { decoded: metrics };
    } catch (error) {
      return {
        decodeError:
          error instanceof Error ? error.message : 'The notification could not be decoded.',
      };
    }
  }

  private wait(seconds: number, ble: BleLayer, signal: AbortSignal): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // Finalize after the last eligible millisecond so a queued boundary packet can be tagged.
      const cancel = this.clock.setTimeout(() => close(false), seconds * 1000 + 1);
      const disconnected = ble.disconnected.subscribe(() => close(true));
      const abort = (): void => close(true);
      function close(interrupted: boolean): void {
        cancel();
        disconnected.unsubscribe();
        signal.removeEventListener('abort', abort);
        resolve(interrupted);
      }
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted || ble.connection().status !== 'connected') close(true);
    });
  }
}
