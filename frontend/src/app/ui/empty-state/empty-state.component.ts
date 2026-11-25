import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// An empty or error state: an icon, a title, a short explanation and its actions
// (docs/design-system/components/empty-state.html). The icon and the actions are projected.
@Component({
  selector: 'g-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <div class="empty">
      <span class="empty__icon"><ng-content select="[emptyIcon]" /></span>
      <h1 class="empty__title">{{ title() }}</h1>
      <p class="empty__text">{{ text() }}</p>
      <div class="empty__actions"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
}
