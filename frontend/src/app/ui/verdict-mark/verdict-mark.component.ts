import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { VerdictKind } from '../../store/model/verdict';

// The verdict's shape, beside its label (docs/design-system/components/verdict-mark.html).
@Component({
  selector: 'g-verdict-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <svg class="vdot" [class.vdot--lg]="large()" viewBox="0 0 12 12" aria-hidden="true">
      @switch (kind()) {
        @case ('connected') {
          <circle class="vdot__connected" cx="6" cy="6" r="5" />
        }
        @case ('partiallyDecoded') {
          <circle class="vdot__partial-ring" cx="6" cy="6" r="4.5" />
          <path class="vdot__partial-half" d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" />
        }
        @case ('needsMissingTool') {
          <circle class="vdot__missing" cx="6" cy="6" r="4.5" />
        }
        @case ('notConnectable') {
          <path class="vdot__none" d="M2 2 L10 10 M10 2 L2 10" />
        }
        @default {
          <rect class="vdot__stopped" x="2" y="2" width="8" height="8" />
        }
      }
    </svg>
  `,
})
export class VerdictMarkComponent {
  readonly kind = input.required<VerdictKind>();
  readonly large = input(false);
}
