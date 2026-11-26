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
  selector: 'g-stop-investigation-dialog',
  imports: [EmergencyStopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="stop-investigation-title"
      aria-describedby="stop-investigation-description"
      (cancel)="close($event)"
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
            [disabled]="busy()"
            (click)="close()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="dialog__header">
          <div>
            <h2 class="dialog__title" id="stop-investigation-title">Stop this investigation?</h2>
            <p
              class="dialog__lead"
              id="stop-investigation-description"
              [attr.role]="busy() ? 'status' : null"
            >
              @if (busy()) {
                Disconnecting… this takes up to 2 seconds.
              } @else {
                @if (device(); as deviceName) {
                  I’ll send nothing more, disconnect from <bdi>{{ deviceName }}</bdi>, and give you
                  a verdict from what’s known so far.
                } @else {
                  I’ll give you a verdict from what’s known so far.
                }
                Everything is kept.
              }
            </p>
          </div>
        </div>
        <div class="dialog__footer">
          <button
            #keepGoing
            class="btn btn--lg"
            type="button"
            [disabled]="busy()"
            (click)="close()"
          >
            Keep going
          </button>
          <button
            class="btn btn--primary btn--lg"
            type="button"
            [disabled]="busy()"
            (click)="confirmed.emit()"
          >
            Stop and get a verdict
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class StopInvestigationDialog {
  readonly device = input<string | null>(null);
  readonly busy = input(false);
  readonly closed = output<void>();
  readonly confirmed = output<void>();
  readonly emergencyStop = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly keepGoing = viewChild.required<ElementRef<HTMLButtonElement>>('keepGoing');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.keepGoing().nativeElement.focus();
    });
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.closed.emit();
  }
}
