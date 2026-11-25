import { inject, Injectable } from '@angular/core';
import { APP_VERSION } from '../app-version';
import { CapabilityDetector } from '../environment/capability-detector';
import { ModeSelector } from '../environment/mode-selector';
import { KnowledgeBase } from '../knowledge-base/knowledge-base';
import { InvestigationStore } from '../store/investigation-store';

// Starts an investigation in one tap (FR-007; start-an-investigation design): re-checks the
// capabilities, picks the mode, creates and commits the record, and asks once for persistent
// storage. It resolves with the new investigation's ID once the record is stored.
@Injectable({ providedIn: 'root' })
export class InvestigationStarter {
  private readonly capabilities = inject(CapabilityDetector);
  private readonly modes = inject(ModeSelector);
  private readonly knowledgeBase = inject(KnowledgeBase);
  private readonly store = inject(InvestigationStore);
  private readonly appVersion = inject(APP_VERSION);

  async start(): Promise<string> {
    const [capabilities, kb] = await Promise.all([
      this.capabilities.detect(),
      this.knowledgeBase.load(),
    ]);
    const investigation = await this.store.create({
      mode: this.modes.select(capabilities),
      appVersion: this.appVersion,
      kbVersion: kb.version,
    });
    void this.store.requestPersistence().catch(() => false);
    return investigation.id;
  }
}
