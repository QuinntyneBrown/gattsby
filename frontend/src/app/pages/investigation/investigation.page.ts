import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PlaybookOrchestrator } from '../../agent/playbook-orchestrator';
import { PROPRIETARY_LEVELS, type ProprietaryLevel } from '../../agent/proprietary-levels';
import { ApprovalGate } from '../../agent/approval-gate';
import { ConfirmationCheck } from '../../agent/confirmation-check';
import { ControlTelemetry } from '../../agent/control-telemetry';
import { EmergencyStopController } from '../../agent/emergency-stop-controller';
import { ChecklistDecider } from '../../agent/checklist-decider';
import { PromptChannel } from '../../agent/prompt-channel';
import { AddNoteDialog } from '../../dialogs/add-note/add-note.dialog';
import { ApprovalDialog } from '../../dialogs/approval/approval.dialog';
import { EmergencyStopDialog } from '../../dialogs/emergency-stop/emergency-stop.dialog';
import { InvestigationMenuDialog } from '../../dialogs/investigation-menu/investigation-menu.dialog';
import { StillThereDialog } from '../../dialogs/still-there/still-there.dialog';
import { UnexpectedEffectDialog } from '../../dialogs/unexpected-effect/unexpected-effect.dialog';
import { LiveMetrics } from '../../live/live-metrics';
import { ModeBannerComponent } from '../../notifications/mode-banner/mode-banner.component';
import { ConnectionBannerComponent } from '../../notifications/connection-banner/connection-banner.component';
import { ConnectionSupervisor } from '../../agent/connection-supervisor';
import { ConnectionReleaser } from '../../agent/connection-releaser';
import { StopInvestigationDialog } from '../../dialogs/stop-investigation/stop-investigation.dialog';
import { LeaveInvestigationDialog } from '../../dialogs/leave-investigation/leave-investigation.dialog';
import { NotificationRecorder } from '../../tools/listening/notification-recorder';
import { ControlPointExchange } from '../../tools/control/control-point-exchange';
import { InvestigationStore } from '../../store/investigation-store';
import type { InvestigationNote } from '../../store/model/investigation-note';
import { StoreError } from '../../store/store-error';
import { confidenceWord } from '../../outcome/confidence-scorer';
import { shortUuid } from '../../knowledge-base/uuid';
import { ActivityFeedComponent } from '../../ui/activity-feed/activity-feed.component';
import { ConfidenceBadgeComponent } from '../../ui/confidence-badge/confidence-badge.component';
import { EmergencyStopButtonComponent } from '../../ui/emergency-stop-button/emergency-stop-button.component';
import {
  PromptCardComponent,
  type PromptCardResponse,
} from '../../ui/prompt-card/prompt-card.component';
import { StageTrackComponent } from '../../ui/stage-track/stage-track.component';

// The Investigation page at /investigations/:id (docs/mocks/pages/investigation/*.html). It runs
// the playbook through its own orchestrator, so leaving the page releases the connection and the
// investigation's memory (FR-018, NFR-005).
@Component({
  selector: 'g-investigation-page',
  imports: [
    RouterLink,
    ActivityFeedComponent,
    ConfidenceBadgeComponent,
    EmergencyStopButtonComponent,
    PromptCardComponent,
    StageTrackComponent,
    StillThereDialog,
    AddNoteDialog,
    ApprovalDialog,
    EmergencyStopDialog,
    UnexpectedEffectDialog,
    InvestigationMenuDialog,
    ModeBannerComponent,
    ConnectionBannerComponent,
    StopInvestigationDialog,
    LeaveInvestigationDialog,
  ],
  providers: [
    PlaybookOrchestrator,
    PromptChannel,
    LiveMetrics,
    NotificationRecorder,
    ConfirmationCheck,
    ApprovalGate,
    ControlPointExchange,
    ControlTelemetry,
    EmergencyStopController,
    ChecklistDecider,
    ConnectionSupervisor,
    ConnectionReleaser,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .reading {
      min-height: 48px;
    }
    .reading__label {
      display: block;
    }
    .note-launch {
      text-align: start;
      cursor: pointer;
    }
  `,
  template: `
    <div class="app app--fixed">
      <header class="appbar">
        <a class="btn btn--ghost btn--icon" routerLink="/" aria-label="Leave the investigation">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <div class="appbar__titles">
          <h1 class="appbar__title">
            <bdi>{{ title() }}</bdi>
          </h1>
          <p class="appbar__subtitle">{{ subtitle() }}</p>
        </div>
        <div class="appbar__actions">
          @if (connected() || orchestrator.recovery.state()?.kind === 'warning') {
            <g-emergency-stop-button (pressed)="orchestrator.stop('emergencyStop')" />
          }
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            aria-label="Investigation options"
            [disabled]="!orchestrator.investigation()"
            (click)="optionsOpen.set(true)"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </header>
      <g-stage-track [stages]="orchestrator.stageStates()" />
      <main id="main" class="inv" tabindex="-1">
        <div class="hypo-strip">
          <span class="hypo-strip__label">Hypothesis</span>
          <span class="hypo-strip__value">{{ hypothesis()?.label ?? 'None yet' }}</span>
          @if (hypothesis(); as h) {
            <span class="meter">
              <span
                class="meter__track"
                role="progressbar"
                aria-label="Confidence"
                [attr.aria-valuenow]="percent()"
                aria-valuemin="0"
                aria-valuemax="100"
                ><span class="meter__fill" [style.--value]="percent() + '%'"></span
              ></span>
              <span class="meter__value">{{ percent() }}%</span>
            </span>
          }
        </div>
        <section
          class="inv__feed"
          aria-label="Activity"
          [attr.aria-busy]="loading() ? 'true' : null"
        >
          @if (orchestrator.recovery.state(); as recovery) {
            <g-connection-banner
              [state]="recovery"
              (answered)="orchestrator.recovery.choose($event)"
            />
          }
          @if (orchestrator.mode() === 'checklist' && !modeBannerDismissed()) {
            <g-mode-banner
              [reason]="orchestrator.modeChange()?.reason ?? null"
              (dismissed)="modeBannerDismissed.set(true)"
            />
          }
          <div class="feed-scroll" #feedScroll>
            <div class="feed-wrap">
              <g-activity-feed [entries]="orchestrator.feed()" />
            </div>
          </div>
        </section>
        <section class="inv__prompt dock" aria-labelledby="prompt-title" aria-live="polite">
          @switch (orchestrator.status()) {
            @case ('paused') {
              <div class="dock__inner">
                <p class="prompt__eyebrow">Interrupted</p>
                <h2 class="prompt__title" id="prompt-title">This investigation was interrupted</h2>
                <p class="prompt__detail">
                  Everything up to step {{ orchestrator.investigation()?.lastCommittedStep }} is
                  saved.
                </p>
                <div class="prompt__actions">
                  <a class="btn btn--primary btn--lg" routerLink="/">Back to home</a>
                </div>
              </div>
            }
            @case ('error') {
              <div class="dock__inner">
                <h2 class="prompt__title" id="prompt-title">Gattsby stopped this investigation</h2>
                <p class="prompt__detail">
                  Something went wrong in Gattsby itself. Everything so far is saved.
                </p>
                <div class="prompt__actions">
                  <a class="btn btn--primary btn--lg" routerLink="/">Back to home</a>
                </div>
              </div>
            }
            @default {
              @if (orchestrator.modelThinking()) {
                <div class="dock__inner" role="status">
                  <h2 class="prompt__title" id="prompt-title">Choosing the next step</h2>
                  <p class="prompt__detail">
                    The on-device model is reviewing what the device has reported.
                  </p>
                </div>
              }
              @if (metrics().length > 0) {
                <div class="dock__inner" aria-live="off">
                  <div class="live-strip" role="group" aria-label="Live readings">
                    @if (connected()) {
                      <span class="live-badge">Live</span>
                    }
                    @for (field of metrics(); track field.metric) {
                      <div class="reading">
                        <span class="reading__label">
                          <span>{{ field.label }}</span>
                          @if (!orchestrator.confirmedMetrics().has(field.metric)) {
                            <span aria-hidden="true">~</span>
                            <span class="visually-hidden">likely</span>
                          } @else {
                            <span class="visually-hidden">confirmed</span>
                          }
                        </span>
                        <span class="reading__value">{{
                          metricValue(field.value, field.scale)
                        }}</span>
                        <span class="reading__unit">{{ field.unit }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
              <g-prompt-card
                [prompt]="unexpectedEffect() ? null : prompts.current()"
                [running]="
                  orchestrator.recovery.state()?.kind === 'warning' ? null : orchestrator.running()
                "
                (respond)="respond($event)"
                (stop)="orchestrator.stop('personStop')"
              />
            }
          }
        </section>
        @if (orchestrator.mode() === 'checklist' && orchestrator.status() === 'running') {
          <div class="inv__composer-wrap">
            <div class="composer">
              <button class="composer__input note-launch" type="button" (click)="openNote()">
                Add a note…
              </button>
            </div>
          </div>
        }
        <aside class="inv__panel" aria-label="Hypothesis, live readings and device">
          <section>
            <p class="panel-section__label">Hypothesis</p>
            <p class="panel-hypo">{{ hypothesis()?.label ?? 'None yet' }}</p>
            @if (hypothesis(); as h) {
              <div class="meter meter--lg" style="margin-top: var(--space-3)">
                <span
                  class="meter__track"
                  role="progressbar"
                  aria-label="Confidence"
                  [attr.aria-valuenow]="percent()"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  ><span class="meter__fill" [style.--value]="percent() + '%'"></span
                ></span>
                <span class="meter__value">{{ percent() }}%</span>
                <g-confidence-badge [word]="word()" />
              </div>
            } @else {
              <p class="text-muted text-sm" style="margin-top: var(--space-2)">
                Forms after the first connection.
              </p>
            }
          </section>
          <section>
            <div class="section-head">
              <h2 class="section-title">Live readings</h2>
              @if (connected() && liveRate(); as rate) {
                <span class="live-badge">{{ rate }} Hz</span>
              }
            </div>
            @if (metrics().length > 0) {
              <dl class="readings">
                @for (field of metrics(); track field.metric) {
                  <div class="readings__row">
                    <dt>{{ field.label }}</dt>
                    <dd class="readings__value">
                      {{ metricValue(field.value, field.scale) }} {{ field.unit }}
                    </dd>
                    <dd class="readings__tag">
                      <g-confidence-badge
                        [word]="
                          orchestrator.confirmedMetrics().has(field.metric) ? 'confirmed' : 'likely'
                        "
                      />
                    </dd>
                  </div>
                }
              </dl>
            } @else {
              <p class="text-muted text-sm" style="margin-top: var(--space-2)">
                Appear here once the machine is moving.
              </p>
            }
          </section>
          @if (orchestrator.stage() === 'proprietary') {
            <section>
              <h2 class="section-title">Recordings</h2>
              <dl class="kv kv--narrow">
                @for (level of recordingLevels; track level) {
                  <dt>{{ level[0].toUpperCase() + level.slice(1) }}</dt>
                  <dd>{{ recordingLabel(level) }}</dd>
                }
              </dl>
            </section>
          }
          <section>
            <h2 class="section-title">Device</h2>
            <dl class="kv">
              <dt>Advertised name</dt>
              <dd>
                <bdi>{{ deviceName() ?? '—' }}</bdi>
              </dd>
              <dt>Maker</dt>
              <dd>
                <bdi>{{ deviceInfo()?.manufacturer ?? '—' }}</bdi>
              </dd>
              <dt>Model</dt>
              <dd>
                <bdi>{{ deviceInfo()?.model ?? '—' }}</bdi>
              </dd>
              <dt>Firmware</dt>
              <dd>
                <bdi>{{ deviceInfo()?.firmware ?? '—' }}</bdi>
              </dd>
              <dt>Services</dt>
              <dd class="mono">{{ services() }}</dd>
            </dl>
          </section>
        </aside>
      </main>
      @if (orchestrator.emergencyStop.view(); as emergency) {
        <g-emergency-stop-dialog
          [state]="emergency"
          [treadmill]="
            hypothesis()?.deviceType === 'treadmill' ||
            orchestrator.state().machineType === 'treadmill'
          "
          (reported)="orchestrator.emergencyStop.report($event)"
        />
      } @else if (unexpectedEffect(); as effect) {
        <g-unexpected-effect-dialog
          [title]="effect.title"
          [detail]="effect.detail"
          [connected]="connected()"
          (finish)="finishReadOnly(effect.id)"
          (emergencyStop)="orchestrator.stop('emergencyStop')"
        />
      } @else if (orchestrator.approvalGate.request(); as approval) {
        <g-approval-dialog
          [request]="approval"
          [busy]="orchestrator.approvalGate.busy()"
          [connected]="connected()"
          (decided)="orchestrator.approvalGate.respond($event.decision, $event.standClear)"
          (emergencyStop)="orchestrator.stop('emergencyStop')"
        />
      }
      @if (optionsOpen()) {
        <g-investigation-menu-dialog
          [connected]="connected()"
          [running]="orchestrator.status() === 'running'"
          (closed)="optionsOpen.set(false)"
          (noteRequested)="openNote()"
          (emergencyStop)="orchestrator.stop('emergencyStop')"
          (stopRequested)="stopOpen.set(true)"
          (pauseRequested)="orchestrator.pause('person')"
        />
      }
      @if (stopOpen()) {
        <g-stop-investigation-dialog
          [device]="connected() ? (deviceName() ?? 'Unnamed device') : null"
          [busy]="stopping()"
          (closed)="stopOpen.set(false)"
          (confirmed)="confirmStop()"
          (emergencyStop)="stopInEmergency()"
        />
      }
      @if (leaveOpen()) {
        <g-leave-investigation-dialog
          [device]="deviceName() ?? 'Unnamed device'"
          [busy]="leaving()"
          (answered)="answerLeave($event)"
          (emergencyStop)="emergencyWhileLeaving()"
        />
      }
      @if (noteOpen()) {
        <g-add-note-dialog
          [connected]="connected()"
          [initial]="savedNote()"
          [busy]="savingNote()"
          [error]="noteError()"
          (closed)="noteOpen.set(false)"
          (saveRequested)="saveNote($event)"
          (emergencyStop)="orchestrator.stop('emergencyStop')"
        />
      }
      @if (noteSaved()) {
        <div class="toast" role="status">
          <div class="toast__text">Saved to this investigation.</div>
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            aria-label="Dismiss notification"
            (click)="noteSaved.set(false)"
          >
            ×
          </button>
        </div>
      }
      @if (!orchestrator.emergencyStop.view()) {
        @if (orchestrator.pauseDetails(); as pause) {
          <g-still-there-dialog
            [instruction]="pause.instruction"
            [paused]="pause.reason !== 'idle'"
            [released]="pause.reason === 'hidden'"
            [device]="connected() ? (deviceName() ?? 'Unnamed device') : null"
            (continued)="orchestrator.resumePaused()"
            (saveAndExit)="savePausedExit()"
            (stop)="orchestrator.stop('personStop')"
            (emergencyStop)="orchestrator.stop('emergencyStop')"
          />
        }
      }
    </div>
  `,
})
export class InvestigationPage implements OnInit, OnDestroy {
  readonly id = input.required<string>();
  readonly resume = input<string>();
  protected readonly orchestrator = inject(PlaybookOrchestrator);
  protected readonly prompts = inject(PromptChannel);
  private readonly live = inject(LiveMetrics);
  protected readonly metrics = this.live.metrics;
  protected readonly liveRate = computed(() => {
    const rate = this.live.rateHz();
    return rate === null ? null : Math.round(rate * 10) / 10;
  });
  private readonly router = inject(Router);
  private readonly store = inject(InvestigationStore);
  private readonly injector = inject(Injector);
  private readonly feedScroll = viewChild<ElementRef<HTMLElement>>('feedScroll');
  private readonly noteDialog = viewChild(AddNoteDialog);
  protected readonly optionsOpen = signal(false);
  protected readonly stopOpen = signal(false);
  protected readonly stopping = signal(false);
  protected readonly leaveOpen = signal(false);
  protected readonly leaving = signal(false);
  private leaveAnswer: ((leave: boolean) => void) | null = null;
  protected readonly unexpectedEffect = computed(() => {
    const prompt = this.prompts.current();
    return prompt?.kind === 'control-warning' ? prompt : null;
  });
  protected readonly modeBannerDismissed = signal(false);
  protected readonly noteOpen = signal(false);
  protected readonly savingNote = signal(false);
  protected readonly noteSaved = signal(false);
  protected readonly savedNote = signal<InvestigationNote>({ location: '', note: '' });
  protected readonly noteError = signal<{ title: string; message: string } | null>(null);

  protected readonly loading = computed(() => this.orchestrator.status() === 'loading');
  protected readonly recordingLevels = PROPRIETARY_LEVELS;
  protected readonly connected = computed(
    () => this.orchestrator.connection().status === 'connected',
  );
  protected readonly hypothesis = this.orchestrator.hypothesis;
  protected readonly percent = computed(() =>
    Math.round((this.hypothesis()?.confidence ?? 0) * 100),
  );
  protected readonly word = computed(() => confidenceWord(this.hypothesis()?.confidence ?? 0));
  protected readonly deviceName = computed(() => this.orchestrator.state().device?.name ?? null);
  protected readonly deviceInfo = computed(() => {
    const info = this.orchestrator.state().deviceInfo;
    return info && info !== 'absent' ? info : null;
  });
  protected readonly services = computed(
    () =>
      this.orchestrator
        .state()
        .layout?.map((s) => shortUuid(s.uuid))
        .join(' ') || '—',
  );
  protected readonly title = computed(() => {
    const device = this.orchestrator.state().device;
    return device ? (device.name ?? 'Unnamed device') : 'New investigation';
  });
  protected readonly subtitle = computed(
    () =>
      `${this.orchestrator.mode() === 'checklist' ? 'Checklist' : 'Agent'} · ${
        this.orchestrator.stageStates().find((s) => s.state === 'now')?.name ?? ''
      }`,
  );

  constructor() {
    inject(ConnectionReleaser).watch(
      () => this.connected() && !this.orchestrator.recording(),
      () => this.orchestrator.releaseForHiddenPage(),
    );
    effect(() => {
      if (this.prompts.idle()) this.orchestrator.pause('idle');
    });
    effect(() => {
      this.orchestrator.feed();
      const scroll = this.feedScroll()?.nativeElement;
      if (scroll) queueMicrotask(() => scroll.scrollTo({ top: scroll.scrollHeight }));
    });
  }

  ngOnInit(): void {
    void this.orchestrator.open(this.id(), this.resume() === 'true').then(() => {
      const investigation = this.orchestrator.investigation();
      this.savedNote.set({
        location: investigation?.location ?? '',
        note: investigation?.note ?? '',
      });
      if (
        this.orchestrator.status() === 'concluded' &&
        investigation?.verdict &&
        !this.router.url.endsWith('/verdict')
      ) {
        void this.router.navigate(['/investigations', investigation.id, 'verdict'], {
          replaceUrl: true,
        });
      }
    });
  }

  ngOnDestroy(): void {
    void this.orchestrator.leave();
  }

  async canLeave(): Promise<boolean> {
    const status = this.orchestrator.status();
    if (status === 'concluded' || status === 'concluding' || status === 'loading' || this.leaving())
      return true;
    if (!this.connected()) {
      await this.orchestrator.saveExit();
      return true;
    }
    this.leaveAnswer?.(false);
    return new Promise((resolve) => {
      this.leaveAnswer = resolve;
      this.leaveOpen.set(true);
    });
  }

  protected async savePausedExit(): Promise<void> {
    this.leaving.set(true);
    await this.orchestrator.saveExit();
    await this.router.navigate(['/']);
  }

  protected async answerLeave(leave: boolean): Promise<void> {
    const answer = this.leaveAnswer;
    if (!answer || this.leaving()) return;
    if (leave) {
      this.leaving.set(true);
      await this.orchestrator.saveExit();
    }
    this.leaveOpen.set(false);
    this.leaving.set(false);
    this.leaveAnswer = null;
    answer(leave);
  }

  protected emergencyWhileLeaving(): void {
    if (this.leaving()) return;
    void this.answerLeave(false);
    this.orchestrator.stop('emergencyStop');
  }

  protected confirmStop(): void {
    this.stopping.set(true);
    this.orchestrator.stop('personStop');
  }

  protected stopInEmergency(): void {
    this.stopOpen.set(false);
    this.orchestrator.stop('emergencyStop');
  }

  protected respond(response: PromptCardResponse): void {
    this.prompts.respond(response);
  }

  protected recordingLabel(level: ProprietaryLevel): string {
    const recording = this.orchestrator.state().proprietaryRecordings[level];
    switch (recording?.status) {
      case 'recorded':
        return `${recording.seconds} s · ${recording.count} packets`;
      case 'ready':
        return 'Recording';
      case 'skipped':
        return 'Skipped';
      case 'failed':
        return 'No recording';
      default:
        return this.prompts.current()?.title &&
          this.recordingLevels.find(
            (level) => !this.orchestrator.state().proprietaryRecordings[level],
          ) === level
          ? 'Waiting for Ready'
          : '—';
    }
  }

  protected openNote(): void {
    this.noteError.set(null);
    this.noteSaved.set(false);
    this.optionsOpen.set(false);
    this.noteOpen.set(true);
  }

  protected finishReadOnly(promptId: string): void {
    this.prompts.respond({
      promptId,
      answer: 'Finish read-only',
      freeText: null,
      skipped: false,
      readyAt: null,
      doneAt: null,
    });
  }

  protected async saveNote(note: InvestigationNote): Promise<void> {
    this.savingNote.set(true);
    this.noteError.set(null);
    try {
      this.savedNote.set(await this.store.saveNote(this.id(), note));
      this.noteDialog()?.dismiss();
      this.noteSaved.set(true);
    } catch (error) {
      const code = error instanceof StoreError ? error.code : null;
      this.noteError.set({
        title: code === 'EMPTY_NOTE' ? 'Nothing to save yet' : 'Couldn’t save this note',
        message:
          code === 'EMPTY_NOTE' || code === 'INVALID_NOTE'
            ? (error as StoreError).message
            : 'Your entry is still here. Try saving again.',
      });
      afterNextRender(() => this.noteDialog()?.focusError(), { injector: this.injector });
    } finally {
      this.savingNote.set(false);
    }
  }

  protected metricValue(value: number, scale: number): string {
    return value.toFixed(scale < 1 ? 1 : 0);
  }
}
