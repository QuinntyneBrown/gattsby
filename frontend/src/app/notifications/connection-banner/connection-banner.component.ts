import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ReconnectBannerState } from '../../agent/reconnect-banner-state';

@Component({
  selector: 'g-connection-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <div
      class="alert inv-banner conn-banner"
      [class.alert--warning]="state().kind === 'warning'"
      [class.alert--success]="state().kind === 'success'"
      [class.alert--danger]="state().kind === 'danger'"
      [attr.role]="state().kind === 'danger' ? 'alert' : 'status'"
    >
      <div class="alert__body">
        @switch (state().kind) {
          @case ('warning') {
            <p class="alert__title">
              @if (state().resumingDevice; as deviceName) {
                Reconnecting to <bdi>{{ deviceName }}</bdi>…
              } @else if (state().recordingSeconds !== null) {
                Connection dropped {{ state().recordingSeconds }} s into the recording.
              } @else {
                Connection dropped.
              }
            </p>
            @if (state().resumingDevice) {
              <p>
                Attempt {{ state().attempt }} of 3. The investigation will continue from where you
                left off.
              </p>
            } @else {
              <p>
                Reconnecting, attempt {{ state().attempt }} of 3. I’ll repeat this step and ignore
                the partial data.
              </p>
            }
          }
          @case ('success') {
            <p class="alert__title">
              Reconnected after {{ state().attempt }} {{ state().attempt === 1 ? 'try' : 'tries' }}.
            </p>
            @if (state().resumingDevice) {
              <p>Continuing where you left off.</p>
            } @else {
              <p>
                Repeating the step that was interrupted. Its partial data is saved and left out of
                analysis.
              </p>
            }
          }
          @case ('danger') {
            <p class="alert__title">Couldn’t reconnect after 3 tries.</p>
            <p>Check the device is on and within a few metres. Everything so far is saved.</p>
          }
        }
      </div>
      @if (state().kind === 'warning') {
        <span class="spinner" aria-hidden="true"></span>
      } @else if (state().kind === 'danger') {
        <div class="alert__actions">
          <button class="btn btn--primary" type="button" (click)="answered.emit(true)">
            Try again
          </button>
          <button class="btn" type="button" (click)="answered.emit(false)">Stop</button>
        </div>
      }
    </div>
  `,
})
export class ConnectionBannerComponent {
  readonly state = input.required<ReconnectBannerState>();
  readonly answered = output<boolean>();
}
