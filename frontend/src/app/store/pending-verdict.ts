import { Injectable, signal } from '@angular/core';
import type { VerdictCommit } from './model/verdict-commit';

// A refused verdict transaction stays available for export or retry until the page is reloaded.
@Injectable({ providedIn: 'root' })
export class PendingVerdict {
  readonly commit = signal<VerdictCommit | null>(null);
}
