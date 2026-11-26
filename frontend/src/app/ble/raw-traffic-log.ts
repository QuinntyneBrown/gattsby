import { inject, Injectable, signal } from '@angular/core';
import { Clock } from '../shared/clock';
import type { RawLogEntry } from '../store/model/raw-log-entry';
import type { NotificationDecoding } from '../store/model/notification-decoding';
import { InvestigationStore } from '../store/investigation-store';
import { StoreError } from '../store/store-error';

export const WINDOW = 2000;
export const FLUSH_BATCH = 200;
export const FLUSH_INTERVAL_MS = 500;
export const QUEUE_LIMIT = 10_000;

export type NewRawLogEntry = Omit<RawLogEntry, 'investigationId' | 'id' | 'seq' | 'stepN' | 't'>;

// The raw traffic log of the investigation in progress (FR-073; log-raw-traffic design). It keeps
// the last 2,000 entries in memory (NFR-005); entries of a long step are flushed to the store as
// provisional rows, and the step commit takes the rest.
@Injectable({ providedIn: 'root' })
export class RawTrafficLog {
  private readonly clock = inject(Clock);
  private readonly store = inject(InvestigationStore);
  private readonly window: RawLogEntry[] = [];
  private pending: RawLogEntry[] = [];
  private investigationId: string | null = null;
  private stepN = 0;
  private seq = 0;
  private cancelFlush: (() => void) | null = null;
  private writing: Promise<void> | null = null;
  private quotaListener: (() => void) | null = null;
  readonly count = signal(0);

  /** Starts logging for an investigation, numbering after the entries it already has. */
  begin(investigationId: string, nextSeq: number): void {
    this.clear();
    this.investigationId = investigationId;
    this.seq = nextSeq;
  }

  /** The step that entries appended from now on belong to. */
  setStep(stepN: number): void {
    this.stepN = stepN;
  }

  /** Appends one entry and returns its evidence ID (`r-` and its sequence number). */
  append(
    entry: NewRawLogEntry,
    decode?: (stamp: Pick<RawLogEntry, 'id' | 't'>) => NotificationDecoding | undefined,
  ): string {
    const id = `r-${this.seq}`;
    const full: RawLogEntry = {
      ...entry,
      investigationId: this.investigationId ?? 'none',
      id,
      seq: this.seq++,
      stepN: this.stepN,
      t: this.clock.now(),
    };
    this.window.push(full);
    if (this.window.length > WINDOW) this.window.splice(0, this.window.length - WINDOW);
    if (decode) Object.assign(full, decode({ id, t: full.t }));
    if (this.investigationId) {
      this.pending.push(full);
      if (this.pending.length >= FLUSH_BATCH) void this.flush();
      else this.cancelFlush ??= this.clock.setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
    }
    this.count.set(this.seq);
    return id;
  }

  latest(n: number): readonly RawLogEntry[] {
    return this.window.slice(-n);
  }

  /** The entries not yet flushed; the step commit writes them with the step (FR-060). */
  takePending(): RawLogEntry[] {
    this.cancelFlush?.();
    this.cancelFlush = null;
    const taken = this.pending;
    this.pending = [];
    return taken;
  }

  async settle(): Promise<void> {
    await this.writing;
  }

  onQuotaFailure(listener: (() => void) | null): void {
    this.quotaListener = listener;
  }

  /** Forgets the window and the queue, after a final flush, when the screen is left (NFR-005). */
  clear(): void {
    if (this.pending.length > 0) void this.flush();
    this.cancelFlush?.();
    this.cancelFlush = null;
    this.pending = [];
    this.window.length = 0;
    this.investigationId = null;
  }

  private flush(): void {
    this.cancelFlush?.();
    this.cancelFlush = null;
    if (this.writing) return;
    const batch = this.pending.splice(0, Math.min(this.pending.length, QUEUE_LIMIT));
    if (!batch.length) return;
    const investigationId = this.investigationId;
    this.writing = this.store
      .flushRawLog(batch)
      .then(() => {
        if (this.investigationId === investigationId && this.pending.length > 0)
          this.cancelFlush ??= this.clock.setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
      })
      .catch((error: unknown) => {
        if (this.investigationId !== investigationId) return;
        this.pending = [...batch, ...this.pending];
        if (error instanceof StoreError && error.code === 'STORAGE_FULL') this.quotaListener?.();
      })
      .finally(() => {
        this.writing = null;
      });
  }
}
