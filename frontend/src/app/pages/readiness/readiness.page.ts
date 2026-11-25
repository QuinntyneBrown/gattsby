import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { toCapabilityItems } from '../../environment/capability-items';
import { CapabilityDetector } from '../../environment/capability-detector';
import type { Capabilities } from '../../environment/capabilities';
import { ReadinessSession } from '../../environment/readiness-session';
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
        @if (canContinue()) {
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
        } @else {
          <div class="readiness__actions">
            <button class="btn btn--primary btn--lg" type="button" (click)="check()">
              Check again
            </button>
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
  protected readonly capabilities = signal<Capabilities | null>(null);
  protected readonly items = computed(() => toCapabilityItems(this.capabilities()));
  protected readonly modelReady = computed(
    () => this.capabilities()?.model.availability === 'available',
  );
  protected readonly canContinue = computed(() => {
    const c = this.capabilities();
    return c?.secureContext && c.bluetooth.api && c.bluetooth.adapterAvailable && c.storage.open;
  });
  protected readonly heading = computed(() => {
    if (!this.capabilities()) return 'Checking this device…';
    if (!this.canContinue()) return 'This device needs attention.';
    return this.modelReady() ? 'Ready to investigate.' : 'Ready, in checklist mode.';
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
}
