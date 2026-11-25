import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// A confidence or status as a word with its shape, never colour alone (NFR-011;
// docs/design-system/components/badge.html).
@Component({
  selector: 'g-confidence-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `<span class="conf" [class]="modifier()">{{ word() }}</span>`,
})
export class ConfidenceBadgeComponent {
  readonly word = input.required<string>();
  protected readonly modifier = computed(() => {
    switch (this.word()) {
      case 'confirmed':
        return 'conf conf--confirmed';
      case 'likely':
        return 'conf conf--likely';
      case 'claimed only':
        return 'conf conf--claimed';
      default:
        return 'conf';
    }
  });
}
