import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Clock } from '../shared/clock';
import { ModelAdapterLoader } from './model-adapter-loader';
import type { ModelAdapter } from './model-adapter';

@Injectable({ providedIn: 'root' })
export class ModelDownloadController {
  private readonly clock = inject(Clock);
  private readonly models = inject(ModelAdapterLoader);
  private attempt: AbortController | null = null;
  private adapter: ModelAdapter | null = null;
  private readonly statusValue = signal<'idle' | 'downloading' | 'available' | 'failed'>('idle');
  private readonly progressValue = signal(0);
  private readonly elapsedValue = signal(0);
  private stopTick?: () => void;
  readonly status = this.statusValue.asReadonly();
  readonly progress = this.progressValue.asReadonly();
  readonly elapsed = this.elapsedValue.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  async prepare(): Promise<boolean> {
    this.adapter ??= await this.models.load();
    return this.adapter !== null;
  }

  cancel(): void {
    if (!this.attempt) return;
    this.attempt.abort();
    this.attempt = null;
    this.stopTick?.();
    this.stopTick = undefined;
    this.statusValue.set('idle');
  }

  async start(): Promise<void> {
    if (!this.adapter || this.attempt) return;
    const attempt = new AbortController();
    this.attempt = attempt;
    this.statusValue.set('downloading');
    this.progressValue.set(0);
    this.elapsedValue.set(0);
    const started = this.clock.now();
    this.tick(started);
    try {
      await this.adapter.download((percent) => {
        if (this.attempt === attempt) {
          this.progressValue.update((previous) => Math.max(previous, percent));
        }
      }, attempt.signal);
      if (this.attempt !== attempt) return;
      this.progressValue.set(100);
      this.statusValue.set('available');
    } catch {
      if (this.attempt === attempt) this.statusValue.set('failed');
    } finally {
      if (this.attempt === attempt) {
        this.attempt = null;
        this.stopTick?.();
        this.stopTick = undefined;
      }
    }
  }

  private tick(started: number): void {
    this.stopTick = this.clock.setTimeout(() => {
      this.elapsedValue.set(Math.floor((this.clock.now() - started) / 1000));
      this.tick(started);
    }, 1000);
  }
}
