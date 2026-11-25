import { ChangeDetectionStrategy, Component, output } from '@angular/core';

// "Emergency stop": one tap, no confirmation (FR-039; emergency-stop design).
@Component({
  selector: 'g-emergency-stop-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <button
      class="btn btn--stop"
      type="button"
      aria-label="Emergency stop"
      (click)="pressed.emit()"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
      <span class="estop__long">Emergency stop</span>
      <span class="estop__short" aria-hidden="true">Stop</span>
    </button>
  `,
})
export class EmergencyStopButtonComponent {
  readonly pressed = output<void>();
}
