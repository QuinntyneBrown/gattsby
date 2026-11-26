import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../shared/clock';
import { RECONNECT_DELAYS, waitToReconnect } from './reconnect-policy';

describe('Reconnect timing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits 1, 2 and 4 seconds before the successive attempts', async () => {
    const clock = new Clock();
    const abort = new AbortController();
    for (const delay of RECONNECT_DELAYS) {
      const attempt = vi.fn();
      const ready = waitToReconnect(clock, delay, abort.signal).then(attempt);
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(attempt).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await ready;
      expect(attempt).toHaveBeenCalledOnce();
    }
  });

  it('cancels the timer if the investigation stops', async () => {
    const abort = new AbortController();
    const ready = waitToReconnect(new Clock(), 4_000, abort.signal);
    const assertion = expect(ready).rejects.toHaveProperty('name', 'AbortError');
    abort.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
