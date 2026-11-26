import type { Clock } from '../../shared/clock';
import { ToolError } from '../tool-error';

export function waitForAdvertisements(
  clock: Clock,
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const stop = clock.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      stop();
      reject(new ToolError('ABORTED', 'Advertisement watching stopped.'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
