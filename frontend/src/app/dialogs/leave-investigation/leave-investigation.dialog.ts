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
  selector: 'g-leave-investigation-dialog',
  imports: [EmergencyStopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="leave-investigation-title"
      aria-describedby="leave-investigation-description"
      (cancel)="stay($event)"
    >
      <div class="dialog__panel">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__toolbar">
          <g-emergency-stop-button (pressed)="emergencyStop.emit()" />
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            aria-label="Close"
            [disabled]="busy()"
            (click)="stay()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="dialog__header">
          <div>
            <h2 class="dialog__title" id="leave-investigation-title">Leave the investigation?</h2>
            <p
              class="dialog__lead"
              id="leave-investigation-description"
              [attr.role]="busy() ? 'status' : null"
            >
              @if (busy()) {
                Disconnecting from <bdi>{{ device() }}</bdi>…
              } @else {
                It’s saved. Leaving disconnects from <bdi>{{ device() }}</bdi>. Resume it from the
                home screen later.
              }
            </p>
          </div>
        </div>
        <div class="dialog__footer">
          <button
            #stayButton
            class="btn btn--lg"
            type="button"
            (click)="stay()"
            [disabled]="busy()"
          >
            Stay
          </button>
          <button
            class="btn btn--primary btn--lg"
            type="button"
            (click)="answered.emit(true)"
            [disabled]="busy()"
          >
            Leave and disconnect
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class LeaveInvestigationDialog {
  readonly device = input.required<string>();
  readonly busy = input(false);
  readonly answered = output<boolean>();
  readonly emergencyStop = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly stayButton = viewChild.required<ElementRef<HTMLButtonElement>>('stayButton');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.stayButton().nativeElement.focus();
    });
  }

  protected stay(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.answered.emit(false);
  }
}
