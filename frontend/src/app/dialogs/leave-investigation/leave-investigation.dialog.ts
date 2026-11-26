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
      (cancel)="stay($event)"
    >
      <div class="dialog__panel">
        <div class="dialog__toolbar">
          <g-emergency-stop-button (pressed)="emergencyStop.emit()" />
        </div>
        <div class="dialog__header">
          <h2 class="dialog__title" id="leave-investigation-title">Leave the investigation?</h2>
          @if (busy()) {
            <p class="dialog__lead" role="status">
              Disconnecting from <bdi>{{ device() }}</bdi>…
            </p>
          } @else {
            <p class="dialog__lead">
              It’s saved. Leaving disconnects from <bdi>{{ device() }}</bdi>. Resume it from the
              home screen later.
            </p>
          }
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
