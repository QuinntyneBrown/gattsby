import type { Clock } from '../shared/clock';

export const RECONNECT_DELAYS = [1_000, 2_000, 4_000] as const;

export function waitToReconnect(clock: Clock, delay: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const cancel = clock.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delay);
    const abort = () => {
      cancel();
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
