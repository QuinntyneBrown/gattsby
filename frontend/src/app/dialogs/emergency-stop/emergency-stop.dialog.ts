import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { EmergencyStopView } from '../../agent/emergency-stop-controller';

@Component({
  selector: 'g-emergency-stop-dialog',
  styleUrl: '../native-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="dialog" aria-label="Emergency stop" (cancel)="$event.preventDefault()">
      <div class="dialog__panel dialog__panel--danger">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__header">
          <div aria-live="polite">
            <h2 class="dialog__title" tabindex="-1" #heading>
              @switch (state()) {
                @case ('sending') {
                  Sending Stop…
                }
                @case ('acknowledged') {
                  All commands stopped.
                }
                @case ('notAcknowledged') {
                  No answer to Stop.
                }
              }
            </h2>
            <p class="dialog__lead">
              If the machine is still moving, use its own physical stop. Gattsby will send no
              further commands.
            </p>
          </div>
        </div>
        <div class="dialog__footer">
          <button
            class="btn btn--danger btn--lg"
            type="button"
            [disabled]="state() === 'sending'"
            (click)="reported.emit('stillMoving')"
          >
            It’s still moving
          </button>
          <button
            class="btn btn--primary btn--lg"
            type="button"
            [disabled]="state() === 'sending'"
            (click)="reported.emit('stopped')"
          >
            {{ treadmill() ? 'The belt has stopped' : 'The machine has stopped' }}
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class EmergencyStopDialog {
  readonly state = input.required<EmergencyStopView>();
  readonly treadmill = input(false);
  readonly reported = output<'stopped' | 'stillMoving'>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.heading().nativeElement.focus();
    });
  }
}
