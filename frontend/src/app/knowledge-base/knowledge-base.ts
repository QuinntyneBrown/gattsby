import { Injectable } from '@angular/core';
import type { KnowledgeBaseData } from './knowledge-base-data';
import { KnowledgeBaseIndex } from './knowledge-base-index';

// Loads the generated knowledge base once, through a dynamic import, so it sits in its own lazy
// chunk outside the initial bundle (NFR-004; maintain-the-knowledge-base design).
@Injectable({ providedIn: 'root' })
export class KnowledgeBase {
  private loading: Promise<KnowledgeBaseIndex> | null = null;

  load(): Promise<KnowledgeBaseIndex> {
    this.loading ??= import('../../knowledge-base/generated/knowledge-base.json').then(
      (module) =>
        new KnowledgeBaseIndex((module.default ?? module) as unknown as KnowledgeBaseData),
    );
    return this.loading;
  }
}
