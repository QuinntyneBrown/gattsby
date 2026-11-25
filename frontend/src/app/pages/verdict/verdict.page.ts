import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InvestigationStarter } from '../../agent/investigation-starter';
import { ExportDialog } from '../../dialogs/export/export.dialog';
import { KnowledgeBase } from '../../knowledge-base/knowledge-base';
import { InvestigationStore } from '../../store/investigation-store';
import type { InvestigationRecord } from '../../store/model/investigation-record';
import { ConfidenceBadgeComponent } from '../../ui/confidence-badge/confidence-badge.component';
import { VerdictMarkComponent } from '../../ui/verdict-mark/verdict-mark.component';
import { verdictView, type VerdictView } from './verdict-view';

// The Verdict page at /investigations/:id/verdict (docs/mocks/pages/verdict/*.html; FR-057). The
// device is already disconnected when it appears (FR-018).
@Component({
  selector: 'g-verdict-page',
  imports: [RouterLink, ConfidenceBadgeComponent, VerdictMarkComponent, ExportDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <div class="app app--fixed">
      <header class="appbar" style="border-bottom: 0">
        <a class="btn btn--ghost btn--icon" routerLink="/" aria-label="Close">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </a>
        <span class="appbar__titles"></span>
      </header>
      <main
        id="main"
        class="scroll"
        tabindex="-1"
        [attr.aria-busy]="!record() && !failed() ? 'true' : null"
      >
        <div class="page page--reading">
          @if (failed()) {
            <div class="alert alert--danger" role="alert">
              <div class="alert__body">
                <p class="alert__title">This verdict couldn’t be read.</p>
                <p>
                  Chrome didn’t answer when Gattsby opened its storage. Your data is still there.
                  Reload the page.
                </p>
              </div>
            </div>
          } @else if (record(); as r) {
            @if (r.investigation.verdict; as verdict) {
              <p class="verdict__meta">
                <bdi>{{ view()?.meta }}</bdi>
              </p>
              <h1 class="verdict__title">
                <g-verdict-mark [kind]="verdict.kind" [large]="true" />{{ verdict.label }}
              </h1>
              <p class="verdict__summary">{{ verdict.summary }}</p>
              <dl class="verdict__protocol">
                <dt>Protocol</dt>
                <dd>{{ view()?.protocol }}</dd>
              </dl>
              @for (request of r.missingToolRequests; track request.id) {
                <section class="tool-card" [attr.aria-labelledby]="request.id">
                  <p class="tool-card__eyebrow">Missing-tool request raised</p>
                  <h2 class="tool-card__title" [id]="request.id">{{ request.title }}</h2>
                  <p class="tool-card__text">{{ request.reason }}</p>
                </section>
              }
              @if (view()?.readable?.length) {
                <section class="group">
                  <div class="group__head"><h2>Can read</h2></div>
                  <ul class="group__items">
                    @for (item of view()!.readable; track item.key) {
                      <li>
                        <span class="group__k">{{ item.key }}</span>
                        <span class="group__v"
                          ><bdi>{{ item.value }}</bdi></span
                        >
                        <g-confidence-badge word="confirmed" />
                      </li>
                    }
                  </ul>
                </section>
              }
              @if (view()?.observed?.length) {
                <section class="group">
                  <div class="group__head"><h2>Observed</h2></div>
                  <ul class="group__items">
                    @for (item of view()!.observed; track $index) {
                      <li>
                        <span class="group__k">{{ item.key }}</span>
                        <span class="group__v"
                          ><bdi>{{ item.value }}</bdi></span
                        >
                        @if (item.tag) {
                          <g-confidence-badge [word]="item.tag" />
                        }
                      </li>
                    }
                  </ul>
                </section>
              }
              <section class="group">
                <div class="group__head"><h2>Couldn’t determine</h2></div>
                <ul class="group__items">
                  @for (item of view()!.undetermined; track $index) {
                    <li>
                      <span class="group__k">{{ item.key }}</span>
                      <span class="group__v">{{ item.value }}</span>
                    </li>
                  }
                </ul>
              </section>
            } @else {
              <p class="lead">This investigation has no verdict yet.</p>
            }
          } @else {
            <span class="skeleton skeleton--text" style="width: 60%"></span>
            <span class="skeleton skeleton--title" style="margin-top: var(--space-4)"></span>
            <span class="skeleton skeleton--text" style="margin-top: var(--space-4)"></span>
            <span class="skeleton skeleton--text"></span>
          }
        </div>
      </main>
      <div class="action-bar">
        <div class="action-bar__inner">
          @if (record()?.investigation?.profileId; as profileId) {
            <a class="btn btn--lg" [routerLink]="['/profiles', profileId]">Open device profile</a>
            <button class="btn btn--lg" type="button" (click)="exporting.set(profileId)">
              Export profile
            </button>
          }
          <button
            class="btn btn--primary btn--lg"
            type="button"
            [disabled]="starting()"
            (click)="newInvestigation()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
            New investigation
          </button>
        </div>
      </div>
    </div>
    @if (exporting(); as profileId) {
      <g-export-dialog [profileId]="profileId" (closed)="exporting.set(null)" />
    }
  `,
})
export class VerdictPage implements OnInit {
  readonly id = input.required<string>();
  private readonly store = inject(InvestigationStore);
  private readonly knowledgeBase = inject(KnowledgeBase);
  private readonly starter = inject(InvestigationStarter);
  private readonly router = inject(Router);
  protected readonly record = signal<InvestigationRecord | null>(null);
  protected readonly view = signal<VerdictView | null>(null);
  protected readonly failed = signal(false);
  protected readonly starting = signal(false);
  protected readonly exporting = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const [record, kb] = await Promise.all([
        this.store.get(this.id()),
        this.knowledgeBase.load(),
      ]);
      this.view.set(verdictView(record, (uuid) => kb.nameOf(uuid)));
      this.record.set(record);
    } catch {
      this.failed.set(true);
    }
  }

  protected async newInvestigation(): Promise<void> {
    this.starting.set(true);
    try {
      const id = await this.starter.start();
      await this.router.navigate(['/investigations', id]);
    } finally {
      this.starting.set(false);
    }
  }
}
