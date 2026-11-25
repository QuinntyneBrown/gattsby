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
import { BrandComponent } from '../../ui/brand/brand.component';
import { CapabilityListComponent } from '../../ui/capability-list/capability-list.component';

@Component({
  selector: 'g-readiness-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandComponent, CapabilityListComponent],
  template: `
    <main
      id="main"
      class="page page--narrow readiness"
      tabindex="-1"
      [attr.aria-busy]="!capabilities()"
    >
      <g-brand [standalone]="true" />
      <h1 style="margin-top: var(--space-10)">{{ heading() }}</h1>
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
          <div class="readiness__body">
            <div>
              <p class="mode-note__title">
                {{ modelReady() ? 'Full agent mode' : 'Checklist mode' }}
              </p>
              <p class="mode-note__text">
                {{
                  modelReady()
                    ? 'The agent runs on Gemini Nano inside Chrome. It plans each step, explains it, and works offline from here on.'
                    : 'The same playbook guides you through the investigation one step at a time.'
                }}
              </p>
            </div>
          </div>
          <div class="readiness__actions">
            @if (modelReady()) {
              <button class="btn btn--primary btn--lg" type="button" (click)="continueAs('agent')">
                Start
              </button>
              <button class="btn btn--ghost" type="button" (click)="continueAs('checklist')">
                Use checklist mode instead
              </button>
            } @else {
              <button
                class="btn btn--primary btn--lg"
                type="button"
                (click)="continueAs('checklist')"
              >
                Start in checklist mode
              </button>
            }
          </div>
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
  protected readonly items = computed(() => toCapabilityItems(this.capabilities()));
  protected readonly modelReady = computed(
    () => this.capabilities()?.model.availability === 'available',
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
        return this.modelReady() ? 'Ready to investigate.' : 'Ready, in checklist mode.';
    }
  });

  ngOnInit(): void {
    void this.check();
  }

  protected async check(): Promise<void> {
    this.capabilities.set(null);
    this.capabilities.set(await this.detector.detect());
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
