import { Injectable } from '@angular/core';

// The time source for timestamps and time-driven rules. `now()` is milliseconds since the epoch
// with a sub-millisecond fraction (FR-073). Unit tests provide a fake.
@Injectable({ providedIn: 'root' })
export class Clock {
  now(): number {
    return performance.timeOrigin + performance.now();
  }

  setTimeout(callback: () => void, ms: number): () => void {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  }
}
