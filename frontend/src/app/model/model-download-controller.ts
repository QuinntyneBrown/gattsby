import { DestroyRef, inject, Injectable, Injector, signal } from '@angular/core';
import { Clock } from '../shared/clock';
import type { PromptApiModelAdapter } from './prompt-api-model-adapter';

@Injectable({ providedIn: 'root' })
export class ModelDownloadController {
  private readonly clock = inject(Clock);
  private readonly injector = inject(Injector);
  private readonly lifetime = new AbortController();
  private adapter: PromptApiModelAdapter | null = null;
  private loading: Promise<void> | null = null;
  private readonly statusValue = signal<'idle' | 'downloading' | 'available' | 'failed'>('idle');
  private readonly progressValue = signal(0);
  private readonly elapsedValue = signal(0);
  private stopTick?: () => void;
  readonly status = this.statusValue.asReadonly();
  readonly progress = this.progressValue.asReadonly();
  readonly elapsed = this.elapsedValue.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.lifetime.abort();
      this.stopTick?.();
    });
  }

  prepare(): Promise<void> {
    this.loading ??= import('./prompt-api-model-adapter')
      .then(({ PromptApiModelAdapter }) => {
        this.adapter = this.injector.get(PromptApiModelAdapter);
      })
      .catch((error: unknown) => {
        this.loading = null;
        throw error;
      });
    return this.loading;
  }

  async start(): Promise<void> {
    if (!this.adapter || this.status() === 'downloading') return;
    this.statusValue.set('downloading');
    this.progressValue.set(0);
    this.elapsedValue.set(0);
    const started = this.clock.now();
    this.tick(started);
    try {
      await this.adapter.download(
        (percent) => this.progressValue.update((previous) => Math.max(previous, percent)),
        this.lifetime.signal,
      );
      this.progressValue.set(100);
      this.statusValue.set('available');
    } catch {
      this.statusValue.set('failed');
    } finally {
      this.stopTick?.();
      this.stopTick = undefined;
    }
  }

  private tick(started: number): void {
    this.stopTick = this.clock.setTimeout(() => {
      this.elapsedValue.set(Math.floor((this.clock.now() - started) / 1000));
      this.tick(started);
    }, 1000);
  }
}
