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
  selector: 'g-unexpected-effect-dialog',
  imports: [EmergencyStopButtonComponent],
  styleUrl: '../native-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-label="Unexpected response"
      (cancel)="$event.preventDefault()"
    >
      <div class="dialog__panel dialog__panel--danger">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__header">
          <div>
            <p class="dialog__eyebrow dialog__eyebrow--danger">Unexpected response</p>
            <h2 class="dialog__title">{{ title() }}</h2>
            <p class="dialog__lead">{{ detail() }}</p>
          </div>
        </div>
        <div class="dialog__body">
          <p class="dialog__warn">
            Use the machine’s physical stop if it is still moving. You can also use Emergency stop.
          </p>
        </div>
        <div class="dialog__footer">
          <button class="btn btn--lg" type="button" (click)="finish.emit()">
            Finish read-only
          </button>
          @if (connected()) {
            <g-emergency-stop-button (pressed)="emergencyStop.emit()" />
          }
        </div>
      </div>
    </dialog>
  `,
})
export class UnexpectedEffectDialog {
  readonly title = input.required<string>();
  readonly detail = input.required<string | null>();
  readonly connected = input(false);
  readonly finish = output<void>();
  readonly emergencyStop = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
