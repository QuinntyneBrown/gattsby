import { Injectable } from '@angular/core';
import type { OperatingMode } from '../store/model/operating-mode';
import type { Capabilities } from './capabilities';

// Picks the operating mode (FR-005): full agent mode when the on-device model is available,
// checklist mode otherwise. The choose-operating-mode design adds the person's preference and the
// download offer (journeys 6 and 7).
@Injectable({ providedIn: 'root' })
export class ModeSelector {
  select(capabilities: Capabilities): OperatingMode {
    return capabilities.model.availability === 'available' ? 'agent' : 'checklist';
  }
}
