import { DestroyRef, inject, Injectable } from '@angular/core';
import { Clock } from '../shared/clock';
import { ModelAdapterLoader } from './model-adapter-loader';
import type { ModelSession } from './model-session';

const SESSION_TIMEOUT = 10_000;
const HANDOFF_TIMEOUT = 15_000;

// Hands a session created at startup to the investigation page that owns its lifetime.
@Injectable({ providedIn: 'root' })
export class ModelSessions {
  private readonly adapters = inject(ModelAdapterLoader);
  private readonly clock = inject(Clock);
  private pending: { id: string; session: ModelSession; releaseTimer: () => void } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.discard());
  }

  async create(): Promise<ModelSession | null> {
    const abort = new AbortController();
    const session = this.adapters
      .load()
      .then((adapter) => adapter?.open(abort.signal) ?? null)
      .catch(() => null);
    let stop: (() => void) | undefined;
    const deadline = new Promise<null>((resolve) => {
      stop = this.clock.setTimeout(() => {
        abort.abort();
        resolve(null);
      }, SESSION_TIMEOUT);
    });
    try {
      return await Promise.race([session, deadline]);
    } finally {
      stop?.();
    }
  }

  hold(id: string, session: ModelSession): void {
    this.discard();
    const releaseTimer = this.clock.setTimeout(() => this.discard(), HANDOFF_TIMEOUT);
    this.pending = { id, session, releaseTimer };
  }

  take(id: string): ModelSession | null {
    if (this.pending?.id !== id) return null;
    const { session, releaseTimer } = this.pending;
    releaseTimer();
    this.pending = null;
    return session;
  }

  private discard(): void {
    this.pending?.releaseTimer();
    this.pending?.session.destroy();
    this.pending = null;
  }
}
