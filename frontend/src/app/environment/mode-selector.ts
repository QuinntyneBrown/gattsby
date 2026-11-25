import { inject, Injectable } from '@angular/core';
import { InvestigationStore } from '../store/investigation-store';
import type { OperatingMode } from '../store/model/operating-mode';
import type { Capabilities } from './capabilities';
import { ReadinessSession } from './readiness-session';

// Picks the operating mode (FR-005): full agent mode when the on-device model is available,
// checklist mode otherwise. The choose-operating-mode design adds the person's preference and the
// download offer (journeys 6 and 7).
@Injectable({ providedIn: 'root' })
export class ModeSelector {
  private readonly store = inject(InvestigationStore);
  private readonly session = inject(ReadinessSession);

  async prefersAgent(): Promise<boolean> {
    if (this.session.choice() === 'checklist') return false;
    return this.store.useAgentWhenAvailable().catch(() => false);
  }

  select(capabilities: Capabilities, prefersAgent: boolean): OperatingMode {
    return prefersAgent && capabilities.model.availability === 'available' ? 'agent' : 'checklist';
  }
}
