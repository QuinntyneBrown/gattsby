import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { toCapabilityItems } from '../../environment/capability-items';
import { CapabilityDetector } from '../../environment/capability-detector';
import type { Capabilities } from '../../environment/capabilities';
import { ReadinessSession } from '../../environment/readiness-session';
import { canStartInvestigation, readinessIssue } from '../../environment/readiness-issue';
import { ModelDownloadController } from '../../model/model-download-controller';
import { formatStorage } from '../../shared/format-storage';
import { BrandComponent } from '../../ui/brand/brand.component';
import { CapabilityListComponent } from '../../ui/capability-list/capability-list.component';

@Component({
  selector: 'g-readiness-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandComponent, CapabilityListComponent],
  styles: `
    progress {
      width: 100%;
      accent-color: var(--color-accent);
    }
    .mode-note__text + .mode-note__text {
      margin-top: var(--space-2);
    }
  `,
  template: `
    <main
      id="main"
      class="page page--narrow readiness"
      tabindex="-1"
      [attr.aria-busy]="!capabilities()"
    >
      <g-brand [standalone]="true" />
      <h1 style="margin-top: var(--space-10)">{{ heading() }}</h1>
      @if (!issue() && phoneModel() && modelState() === 'downloadable') {
        <p class="readiness__body">
          The phone model is a one-time {{ downloadSize() }} download. Mobile data charges may
          apply. Use Wi-Fi if you can.
        </p>
      }
      <g-capability-list [items]="items()" />
      @if (capabilities()) {
        @if (issue(); as issue) {
          @switch (issue) {
            @case ('bluetooth-off') {
              <p class="readiness__body">
                Turn on Bluetooth in this device’s settings, then check again.
              </p>
            }
            @case ('permission') {
              <p class="readiness__body">
                In Chrome, open the site controls beside the address. Allow Bluetooth for this site,
                then check again.
              </p>
            }
            @case ('unsupported') {
              <p class="readiness__body">
                Open Gattsby in Chrome on a laptop, a Chromebook Plus or an Android device to
                connect over Bluetooth.
              </p>
            }
            @case ('insecure') {
              <p class="readiness__body">
                Open the HTTPS address to use Bluetooth, or use localhost for development.
              </p>
            }
            @case ('storage') {
              <p class="readiness__body">
                Allow site data in Chrome and check again. An investigation needs local storage to
                save its evidence.
              </p>
            }
            @case ('outdated') {
              <p class="readiness__body">Use Chrome 148 or later, then check again.</p>
            }
          }
          @if (issue === 'unsupported' || issue === 'insecure') {
            <label class="field">
              <span class="field__label">Gattsby link</span>
              <input #link class="input" type="url" readonly [value]="shareLink" />
            </label>
            <div class="readiness__actions">
              <button class="btn btn--primary btn--lg" type="button" (click)="copyLink(link)">
                Copy link
              </button>
            </div>
            @if (copyStatus()) {
              <p class="fine-print" role="status">{{ copyStatus() }}</p>
            }
          } @else {
            <div class="readiness__actions">
              <button class="btn btn--primary btn--lg" type="button" (click)="check()">
                Check again
              </button>
              @if (issue === 'bluetooth-off' || issue === 'permission') {
                <button
                  class="btn btn--lg"
                  type="button"
                  [disabled]="!canContinue()"
                  (click)="continueAs(modelReady() ? 'agent' : 'checklist')"
                >
                  Start
                </button>
              }
            </div>
          }
        } @else {
          @switch (modelState()) {
            @case ('available') {
              <div class="readiness__body">
                <div>
                  <p class="mode-note__title">Full agent mode</p>
                  <p class="mode-note__text">
                    @if (phoneModel()) {
                      The agent runs on the phone model. It plans each step, explains it, and works
                      offline from here on.
                    } @else {
                      The agent runs on Gemini Nano inside Chrome. It plans each step, explains it,
                      and works offline from here on.
                    }
                  </p>
                </div>
              </div>
              <div class="readiness__actions">
                <button
                  class="btn btn--primary btn--lg"
                  type="button"
                  (click)="continueAs('agent')"
                >
                  Start
                </button>
                <button class="btn btn--ghost" type="button" (click)="continueAs('checklist')">
                  Use checklist mode instead
                </button>
              </div>
            }
            @case ('downloadable') {
              <div class="readiness__body">
                <div>
                  @if (!phoneModel()) {
                    <p class="mode-note__text">
                      Chrome downloads the model once. It’s a large download, so check that you have
                      free disk space and use Wi-Fi.
                    </p>
                  }
                  <p class="mode-note__text">
                    You can start right away as a checklist. A later investigation can use the agent
                    when the model is ready.
                  </p>
                </div>
              </div>
              <div class="readiness__actions">
                <button
                  class="btn btn--primary btn--lg"
                  type="button"
                  [disabled]="!downloadReady()"
                  (click)="download.start()"
                >
                  Download the on-device model
                </button>
                <button class="btn btn--ghost" type="button" (click)="continueAs('checklist')">
                  Start with the checklist
                </button>
              </div>
            }
            @case ('downloading') {
              <div class="readiness__body">
                <div>
                  <p class="mode-note__title" role="status">{{ progressText() }}</p>
                  <progress
                    aria-label="Model download"
                    max="100"
                    [attr.value]="download.status() === 'downloading' ? download.progress() : null"
                  ></progress>
                  <p class="mode-note__text">
                    The download can continue while you use checklist mode.
                  </p>
                </div>
              </div>
              <div class="readiness__actions">
                @if (phoneModel()) {
                  <button class="btn btn--lg" type="button" (click)="download.cancel()">
                    Cancel download
                  </button>
                }
                @if (download.status() === 'idle') {
                  <button
                    class="btn btn--lg"
                    type="button"
                    [disabled]="!downloadReady()"
                    (click)="download.start()"
                  >
                    Show download progress
                  </button>
                }
                <button
                  class="btn btn--primary btn--lg"
                  type="button"
                  (click)="continueAs('checklist')"
                >
                  Start with the checklist
                </button>
              </div>
            }
            @case ('failed') {
              <div class="alert alert--danger readiness__body" role="alert">
                <div class="alert__body">
                  <p class="alert__title">Download failed at {{ download.progress() }}%</p>
                  <p>Check your connection and free disk space, then try again.</p>
                </div>
              </div>
              <div class="readiness__actions">
                <button class="btn btn--primary btn--lg" type="button" (click)="download.start()">
                  Retry the download
                </button>
                <button class="btn btn--ghost" type="button" (click)="continueAs('checklist')">
                  Start with the checklist
                </button>
              </div>
            }
            @default {
              <div class="readiness__body">
                <div>
                  <p class="mode-note__title">Checklist mode</p>
                  <p class="mode-note__text">
                    @if (capabilities()?.model?.reason === 'webgpu') {
                      The phone model needs WebGPU.
                    }
                    The same playbook guides you through the investigation one step at a time.
                  </p>
                </div>
              </div>
              <div class="readiness__actions">
                <button
                  class="btn btn--primary btn--lg"
                  type="button"
                  (click)="continueAs('checklist')"
                >
                  Start in checklist mode
                </button>
              </div>
            }
          }
        }
      }
    </main>
  `,
})
export class ReadinessPage implements OnInit {
  private readonly detector = inject(CapabilityDetector);
  private readonly session = inject(ReadinessSession);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly shareLink =
    this.document.location?.protocol === 'https:'
      ? new URL('/', this.document.location.href).href
      : 'https://gray-pond-0fab1480f.6.azurestaticapps.net/';
  protected readonly copyStatus = signal('');
  protected readonly capabilities = signal<Capabilities | null>(null);
  protected readonly download = inject(ModelDownloadController);
  protected readonly downloadReady = signal(false);
  protected readonly phoneModel = computed(() => this.capabilities()?.model.source === 'phone');
  protected readonly downloadSize = computed(() =>
    formatStorage(this.capabilities()?.model.downloadBytes ?? 0),
  );
  protected readonly modelState = computed(() =>
    this.download.status() === 'idle'
      ? (this.capabilities()?.model.availability ?? 'unavailable')
      : this.download.status(),
  );
  protected readonly modelReady = computed(() => this.modelState() === 'available');
  protected readonly progressText = computed(() =>
    this.download.status() === 'downloading'
      ? `Downloading ${this.phoneModel() ? 'the phone model' : 'Gemini Nano'} · ${this.download.progress()}% · ${this.download.elapsed()} s`
      : 'Chrome is downloading Gemini Nano.',
  );
  protected readonly items = computed(() =>
    toCapabilityItems(this.capabilities(), this.modelState(), this.download.progress()),
  );
  protected readonly canContinue = computed(() => {
    const c = this.capabilities();
    return !!c && canStartInvestigation(c);
  });
  protected readonly issue = computed(() => {
    const c = this.capabilities();
    return c ? readinessIssue(c) : null;
  });
  protected readonly heading = computed(() => {
    const c = this.capabilities();
    if (!c) return 'Checking this device…';
    switch (this.issue()) {
      case 'insecure':
        return 'Bluetooth needs a secure address.';
      case 'unsupported':
        return c.platform.os === 'iOS'
          ? 'Gattsby can’t run on iPhone.'
          : 'This browser can’t connect to a device.';
      case 'outdated':
        return 'Update Chrome to investigate.';
      case 'storage':
        return 'Gattsby can’t save on this device.';
      case 'permission':
        return 'Chrome is blocking Bluetooth.';
      case 'bluetooth-off':
        return 'Bluetooth is off.';
      default:
        switch (this.modelState()) {
          case 'available':
            return 'Ready to investigate.';
          case 'downloadable':
            return 'Download the on-device model?';
          case 'downloading':
            return 'Getting the on-device model ready.';
          case 'failed':
            return 'The model download stopped.';
          default:
            return 'Ready, in checklist mode.';
        }
    }
  });

  ngOnInit(): void {
    void this.check();
  }

  protected async check(): Promise<void> {
    this.capabilities.set(null);
    const capabilities = await this.detector.detect();
    this.capabilities.set(capabilities);
    if (['downloadable', 'downloading'].includes(capabilities.model.availability)) {
      this.downloadReady.set(await this.download.prepare().catch(() => false));
    }
  }

  protected async continueAs(preference: 'agent' | 'checklist'): Promise<void> {
    if (!this.canContinue()) return;
    this.session.continueAs(preference);
    await this.router.navigate(['/'], { replaceUrl: true });
  }

  protected async copyLink(input: HTMLInputElement): Promise<void> {
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (clipboard) {
        await clipboard.writeText(this.shareLink);
        this.copyStatus.set('Link copied.');
        return;
      }
    } catch {
      // Select the link for browsers that refuse clipboard access.
    }
    input.focus();
    input.select();
    this.copyStatus.set('Link selected. Copy it to open Gattsby in Chrome.');
  }
}
