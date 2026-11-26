import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Clock } from '../shared/clock';
import type { RawLogEntry } from '../store/model/raw-log-entry';
import { InvestigationStore } from '../store/investigation-store';
import { FLUSH_BATCH, RawTrafficLog, WINDOW } from './raw-traffic-log';

class FakeClock {
  t = 1_700_000_000_000.25;
  private timers: { at: number; run: () => void }[] = [];
  now(): number {
    return this.t;
  }
  setTimeout(run: () => void, ms: number): () => void {
    const timer = { at: this.t + ms, run };
    this.timers.push(timer);
    return () => (this.timers = this.timers.filter((x) => x !== timer));
  }
  advance(ms: number): void {
    this.t += ms;
    const due = this.timers.filter((x) => x.at <= this.t);
    this.timers = this.timers.filter((x) => x.at > this.t);
    due.forEach((x) => x.run());
  }
}

describe('RawTrafficLog (FR-073, NFR-005)', () => {
  let log: RawTrafficLog;
  let clock: FakeClock;
  let flushed: RawLogEntry[][];

  beforeEach(() => {
    clock = new FakeClock();
    flushed = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: Clock, useValue: clock },
        {
          provide: InvestigationStore,
          useValue: { flushRawLog: async (e: RawLogEntry[]) => void flushed.push([...e]) },
        },
      ],
    });
    log = TestBed.inject(RawTrafficLog);
    log.begin('i-1', 0);
    log.setStep(3);
  });

  const notification = () =>
    log.append({ kind: 'notification', direction: 'in', uuid: 'u', hex: '01 02' });

  it('numbers entries and stamps them with the step and a timestamp', () => {
    expect(notification()).toBe('r-0');
    expect(notification()).toBe('r-1');
    const [first] = log.takePending();
    expect(first).toMatchObject({ investigationId: 'i-1', seq: 0, stepN: 3, t: clock.t });
  });

  it('keeps only the last 2,000 entries in memory', () => {
    for (let i = 0; i < WINDOW + 50; i++) notification();
    const latest = log.latest(WINDOW + 50);
    expect(latest).toHaveLength(WINDOW);
    expect(latest[0].seq).toBe(50);
  });

  it('flushes a full batch at once and the rest after the interval', async () => {
    for (let i = 0; i < FLUSH_BATCH + 1; i++) notification();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(FLUSH_BATCH);
    await log.settle();
    clock.advance(500);
    expect(flushed).toHaveLength(2);
    expect(log.takePending()).toEqual([]);
  });

  it('hands the step commit what was not flushed', () => {
    notification();
    expect(log.takePending()).toHaveLength(1);
    clock.advance(1000);
    expect(flushed).toEqual([]);
  });
});
