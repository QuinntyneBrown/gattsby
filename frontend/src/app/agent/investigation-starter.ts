import { inject, Injectable } from '@angular/core';
import { APP_VERSION } from '../app-version';
import { CapabilityDetector } from '../environment/capability-detector';
import { ModeSelector } from '../environment/mode-selector';
import { canStartInvestigation } from '../environment/readiness-issue';
import { KnowledgeBase } from '../knowledge-base/knowledge-base';
import { ModelSessions } from '../model/model-sessions';
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
  private readonly modelSessions = inject(ModelSessions);

  async start(): Promise<string | null> {
    const prefersAgent = await this.modes.prefersAgent();
    const [capabilities, kb] = await Promise.all([
      this.capabilities.detect({ model: prefersAgent }),
      this.knowledgeBase.load(),
    ]);
    if (!canStartInvestigation(capabilities)) return null;
    const model =
      this.modes.select(capabilities, prefersAgent) === 'agent'
        ? await this.modelSessions.create()
        : null;
    try {
      const investigation = await this.store.create({
        mode: model ? 'agent' : 'checklist',
        appVersion: this.appVersion,
        kbVersion: kb.version,
      });
      if (model) this.modelSessions.hold(investigation.id, model);
      void this.store.requestPersistence().catch(() => false);
      return investigation.id;
    } catch (error) {
      model?.destroy();
      throw error;
    }
  }
}
