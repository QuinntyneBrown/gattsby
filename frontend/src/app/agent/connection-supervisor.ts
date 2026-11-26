import { Injectable, signal } from '@angular/core';
import type { DisconnectEvent } from '../ble/connection-state';
import type { ReconnectBannerState } from './reconnect-banner-state';

@Injectable()
export class ConnectionSupervisor {
  private readonly banner = signal<ReconnectBannerState | null>(null);
  readonly state = this.banner.asReadonly();
  drop: DisconnectEvent | null = null;
  private respond: ((retry: boolean) => void) | null = null;

  dropped(event: DisconnectEvent, recordingSeconds: number | null): void {
    this.drop = event;
    this.banner.set({ kind: 'warning', attempt: 1, recordingSeconds });
  }

  resuming(deviceId: string, deviceName: string | null, at: number): void {
    this.drop = { deviceId, at, intentional: false };
    this.banner.set({
      kind: 'warning',
      attempt: 1,
      recordingSeconds: null,
      resumingDevice: deviceName ?? 'the device',
    });
  }

  attempting(attempt: number): void {
    this.banner.update((state) => state && { ...state, kind: 'warning', attempt });
  }

  complete(connected: boolean): void {
    this.banner.update((state) => state && { ...state, kind: connected ? 'success' : 'danger' });
    if (connected) this.drop = null;
  }

  choose(retry: boolean): void {
    this.respond?.(retry);
  }

  waitForRetry(signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      const abort = () => finish(false);
      const finish = (retry: boolean) => {
        this.respond = null;
        signal.removeEventListener('abort', abort);
        resolve(retry);
      };
      this.respond = finish;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }

  clear(): void {
    this.drop = null;
    this.banner.set(null);
  }
}
