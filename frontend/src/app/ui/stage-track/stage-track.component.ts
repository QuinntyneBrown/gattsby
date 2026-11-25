import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface StageTrackItem {
  readonly name: string;
  readonly state: 'done' | 'now' | 'to do' | 'skipped';
}

// The playbook's seven stages as a track; each stage's state is in text, not only colour
// (follow-the-investigation design; docs/design-system/components/stage-track.html).
@Component({
  selector: 'g-stage-track',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <ol class="stage-track" [attr.aria-label]="label()">
      @for (stage of stages(); track stage.name) {
        <li
          class="stage-track__seg"
          [attr.aria-current]="stage.state === 'now' ? 'step' : null"
          [attr.data-status]="
            stage.state === 'done' ? 'done' : stage.state === 'skipped' ? 'skipped' : null
          "
          [attr.title]="stage.name + ': ' + stage.state"
        >
          <span class="visually-hidden">{{ stage.name }}: {{ stage.state }}</span>
        </li>
      }
    </ol>
  `,
})
export class StageTrackComponent {
  readonly stages = input.required<readonly StageTrackItem[]>();
  protected readonly label = computed(() => {
    const stages = this.stages();
    const index = stages.findIndex((s) => s.state === 'now');
    return `Playbook, stage ${index + 1} of ${stages.length}: ${stages[index]?.name ?? ''}`;
  });
}
