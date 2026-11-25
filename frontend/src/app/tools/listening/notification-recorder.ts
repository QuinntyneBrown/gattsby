import { inject, Injectable } from '@angular/core';
import { ConfirmationCheck } from '../../agent/confirmation-check';
import { PromptChannel } from '../../agent/prompt-channel';
import type { BleLayer } from '../../ble/ble-layer';
import type { DecodedMetric } from '../../knowledge-base/decoders/decoded-metric';
import type { Decoder } from '../../knowledge-base/decoders/decoder';
import { LiveMetrics } from '../../live/live-metrics';
import { Clock } from '../../shared/clock';
import { ToolError } from '../tool-error';

@Injectable()
export class NotificationRecorder {
  private readonly clock = inject(Clock);
  private readonly live = inject(LiveMetrics);
  private readonly confirmation = inject(ConfirmationCheck);
  private readonly prompts = inject(PromptChannel);

  async record(
    ble: BleLayer,
    service: string,
    characteristic: string,
    decoder: Decoder,
    seconds: number,
    signal: AbortSignal,
  ): Promise<{ count: number; decodeErrors: number }> {
    let count = 0;
    let decodeErrors = 0;
    let recording = true;
    const stop = await ble.subscribe(service, characteristic, ({ bytes, entryId, t }) => {
      if (signal.aborted || this.prompts.idle()) return undefined;
      if (recording) count++;
      try {
        const { value } = decoder.decode(bytes);
        const fields = value as readonly DecodedMetric[];
        this.live.update(fields);
        this.confirmation.sample(fields, entryId, t, recording);
        return { decoded: fields };
      } catch (error) {
        if (recording) decodeErrors++;
        return {
          decodeError:
            error instanceof Error ? error.message : 'The notification could not be decoded.',
        };
      }
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const cancel = this.clock.setTimeout(() => close(), seconds * 1000);
        const disconnected = ble.disconnected.subscribe(() => close());
        const abort = (): void => close(new ToolError('ABORTED', 'The recording was stopped.'));
        function close(error?: ToolError): void {
          cancel();
          disconnected.unsubscribe();
          signal.removeEventListener('abort', abort);
          if (error) reject(error);
          else resolve();
        }
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        else if (ble.connection().status !== 'connected') close();
      });
    } catch (error) {
      await stop();
      throw error;
    } finally {
      recording = false;
    }
    return { count, decodeErrors };
  }
}
