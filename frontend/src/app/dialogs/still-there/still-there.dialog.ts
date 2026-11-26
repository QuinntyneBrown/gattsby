import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { EmergencyStopButtonComponent } from '../../ui/emergency-stop-button/emergency-stop-button.component';

@Component({
  selector: 'g-still-there-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmergencyStopButtonComponent],
  styles: `
    dialog {
      border: 0;
      margin: 0;
      max-width: none;
      max-height: none;
      width: 100%;
      height: 100%;
      background: transparent;
    }
    dialog::backdrop {
      background: var(--color-bg-backdrop);
    }
    dialog:not([open]) {
      display: none;
    }
  `,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="still-there-title"
      aria-describedby="still-there-description"
      (cancel)="cancel($event)"
    >
      <div class="dialog__panel">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__toolbar">
          @if (device()) {
            <g-emergency-stop-button (pressed)="emergencyStop.emit()" />
          }
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            aria-label="Close"
            (click)="continueInvestigation()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="dialog__header">
          <div>
            <h2 class="dialog__title" id="still-there-title">
              {{ paused() ? 'Paused' : 'Still there?' }}
            </h2>
            <p class="dialog__lead" id="still-there-description">
              @if (released()) {
                The page was hidden, so Gattsby disconnected. Resume reconnects to this device.
              } @else if (paused()) {
                Nothing is sent or recorded while paused. Everything so far is saved.
              } @else {
                Nothing has happened for 2 minutes. Everything so far is saved.
              }
            </p>
          </div>
        </div>
        <div class="dialog__body">
          <div class="well-row">
            <p class="well-row__label">Picks up at</p>
            <p class="well-row__title">{{ instruction() }}</p>
            @if (device(); as connectedDevice) {
              <p class="well-row__meta">
                Still connected to <bdi>{{ connectedDevice }}</bdi>
              </p>
            }
          </div>
        </div>
        <div class="dialog__footer">
          <button class="btn btn--lg" type="button" (click)="stop.emit()">
            {{ paused() ? 'Stop and get a verdict' : 'Stop' }}
          </button>
          @if (paused()) {
            <button class="btn btn--lg" type="button" (click)="saveAndExit.emit()">
              Save and exit
            </button>
          }
          <button
            #continueButton
            class="btn btn--primary btn--lg"
            type="button"
            (click)="continueInvestigation()"
          >
            {{ paused() ? 'Resume' : 'Continue' }}
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class StillThereDialog {
  readonly instruction = input.required<string>();
  readonly device = input<string | null>(null);
  readonly paused = input(false);
  readonly released = input(false);
  readonly continued = output<void>();
  readonly stop = output<void>();
  readonly saveAndExit = output<void>();
  readonly emergencyStop = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly continueButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('continueButton');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.continueButton().nativeElement.focus();
    });
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    this.continueInvestigation();
  }

  protected continueInvestigation(): void {
    this.dialog().nativeElement.close();
    this.continued.emit();
  }
}
