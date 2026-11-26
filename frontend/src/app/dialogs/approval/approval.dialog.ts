import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toHex } from '../../ble/hex-codec';
import { shortUuid } from '../../knowledge-base/uuid';
import type { ApprovalDecision } from '../../store/model/approval-decision';
import type { ApprovalRequest } from '../../store/model/approval-request';
import { EmergencyStopButtonComponent } from '../../ui/emergency-stop-button/emergency-stop-button.component';

@Component({
  selector: 'g-approval-dialog',
  imports: [EmergencyStopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  styles:
    '.stand-clear { display: flex; align-items: center; gap: var(--space-2); min-height: 48px; }',
  template: `
    <dialog #dialog class="dialog" aria-label="Approve a command" (cancel)="cancel($event)">
      <div class="dialog__panel">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__toolbar">
          @if (connected()) {
            <g-emergency-stop-button (pressed)="emergencyStop.emit()" />
          }
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            aria-label="Close"
            [disabled]="busy()"
            (click)="decline('cancel')"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="dialog__header">
          <div>
            <p class="dialog__eyebrow">{{ request().sequence }} · Needs your approval</p>
            <h2 class="dialog__title">{{ request().title }}</h2>
            <p class="dialog__lead">{{ request().detail }}</p>
          </div>
        </div>
        <div class="dialog__body stack">
          <div class="bytes">
            <span class="bytes__label">Will send</span>
            <span class="bytes__value">{{ characteristic() }} ← {{ hex() }}</span>
          </div>
          <div class="bytes">
            <span class="bytes__label">Risk</span>
            <span class="bytes__value">{{ request().risk }}</span>
          </div>
          @if (request().isMotion) {
            <p class="dialog__warn">
              Stand clear of the machine and locate its physical stop key or button.
            </p>
            <label class="stand-clear">
              <input
                type="checkbox"
                [checked]="standClear()"
                [disabled]="busy()"
                (change)="checkClear($event)"
              />
              I am clear and know where the stop is
            </label>
          }
          @if (busy()) {
            <p role="status">Sending. Waiting for the device to answer.</p>
          }
        </div>
        <div class="dialog__footer">
          <button
            #no
            class="btn btn--lg"
            type="button"
            [disabled]="busy()"
            (click)="decline('decline')"
          >
            Don’t send
          </button>
          <button
            class="btn btn--primary btn--lg"
            type="button"
            [disabled]="busy() || (request().isMotion && !standClear())"
            (click)="decided.emit({ decision: 'send', standClear: standClear() })"
          >
            Send
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class ApprovalDialog {
  readonly request = input.required<ApprovalRequest>();
  readonly busy = input(false);
  readonly connected = input(false);
  readonly decided = output<{ decision: ApprovalDecision['decision']; standClear: boolean }>();
  readonly emergencyStop = output<void>();
  private readonly clearedFor = signal<ApprovalRequest | null>(null);
  protected readonly standClear = computed(() => this.clearedFor() === this.request());
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly no = viewChild.required<ElementRef<HTMLButtonElement>>('no');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.no().nativeElement.focus();
    });
  }

  protected characteristic(): string {
    return `Fitness Machine Control Point (${shortUuid(this.request().characteristic)})`;
  }

  protected hex(): string {
    return toHex(Uint8Array.from(this.request().bytes));
  }

  protected checkClear(event: Event): void {
    this.clearedFor.set((event.target as HTMLInputElement).checked ? this.request() : null);
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    this.decline('cancel');
  }

  protected decline(decision: 'decline' | 'cancel'): void {
    if (!this.busy()) this.decided.emit({ decision, standClear: false });
  }
}
