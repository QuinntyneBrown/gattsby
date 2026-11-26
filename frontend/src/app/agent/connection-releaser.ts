import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { Clock } from '../shared/clock';

const HIDDEN_RELEASE_MS = 60_000;

@Injectable()
export class ConnectionReleaser {
  private readonly document = inject(DOCUMENT);
  private readonly clock = inject(Clock);
  private readonly destroyRef = inject(DestroyRef);

  watch(eligible: () => boolean, release: () => void): void {
    const hidden = signal(this.document.visibilityState === 'hidden');
    const updateVisibility = () => hidden.set(this.document.visibilityState === 'hidden');
    this.document.addEventListener('visibilitychange', updateVisibility);
    this.document.defaultView?.addEventListener('pagehide', release);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', updateVisibility);
      this.document.defaultView?.removeEventListener('pagehide', release);
    });
    effect((onCleanup) => {
      if (hidden() && eligible()) {
        onCleanup(
          this.clock.setTimeout(() => {
            if (this.document.visibilityState === 'hidden' && eligible()) release();
          }, HIDDEN_RELEASE_MS),
        );
      }
    });
  }
}
