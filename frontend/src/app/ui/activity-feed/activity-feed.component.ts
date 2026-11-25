import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FeedEntry } from '../../agent/feed-entry';
import { ConfidenceBadgeComponent } from '../confidence-badge/confidence-badge.component';

// The activity feed (follow-the-investigation design; docs/design-system/components/
// activity-feed.html). Every string is bound as text, never as HTML (NFR-013).
@Component({
  selector: 'g-activity-feed',
  imports: [ConfidenceBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <ol class="feed">
      @for (entry of entries(); track entry.id) {
        @switch (entry.kind) {
          @case ('stageStart') {
            <li class="feed__divider">{{ entry.title }}</li>
          }
          @case ('message') {
            @if (entry.speaker === 'person') {
              <li class="msg msg--person">
                <p class="msg__text"><span class="visually-hidden">You: </span>{{ entry.text }}</p>
              </li>
            } @else {
              <li class="msg">
                <span class="msg__avatar">
                  <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
                    <path class="mark__arc" d="M48.97 15.03 A24 24 0 1 0 56 32 H44" />
                    <circle class="mark__dot" cx="32" cy="32" r="4.5" />
                  </svg>
                </span>
                <div class="msg__body">
                  <p class="msg__text">
                    <span class="visually-hidden"
                      >{{ entry.speaker === 'checklist' ? 'Checklist' : 'Agent' }}: </span
                    >{{ entry.text }}
                  </p>
                  @if (entry.why) {
                    <p class="msg__why">
                      {{ entry.speaker === 'checklist' ? 'Purpose' : 'Why' }}: {{ entry.why }}
                    </p>
                  }
                </div>
              </li>
            }
          }
          @case ('tool') {
            <li
              class="probe feed__indent"
              [class.probe--running]="entry.running"
              [class.probe--error]="entry.failed"
              [attr.aria-busy]="entry.running ? 'true' : null"
            >
              <div class="probe__head">
                <span class="probe__tool">{{ entry.tool }}</span>
                <span class="probe__purpose">{{ entry.purpose }}</span>
                @if (entry.running) {
                  <span class="spinner" role="img" aria-label="Running"></span>
                } @else if (entry.durationMs !== null) {
                  <span class="probe__time">{{ seconds(entry.durationMs) }}</span>
                }
              </div>
              @if (!entry.running) {
                <div class="probe__body">
                  <p class="probe__result">{{ entry.summary }}</p>
                  @if (entry.observations.length > 0) {
                    <ul class="obs">
                      @for (o of entry.observations; track $index) {
                        <li>
                          <g-confidence-badge [word]="o.tag" /><span>{{ o.text }}</span>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </li>
          }
          @case ('hypothesis') {
            <li class="hypo-change feed__indent">
              <span class="hypo-change__label">Hypothesis</span>
              <span class="hypo-change__value">{{ entry.label }}</span>
              <span class="hypo-change__delta">
                <span class="hypo-change__from">{{ entry.from }}%</span>
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span class="hypo-change__to">{{ entry.to }}%</span>
              </span>
              <g-confidence-badge [word]="entry.word" />
            </li>
          }
        }
      }
    </ol>
  `,
})
export class ActivityFeedComponent {
  readonly entries = input.required<readonly FeedEntry[]>();

  protected seconds(ms: number): string {
    return ms < 1000 ? '<1 s' : `${Math.round(ms / 1000)} s`;
  }
}
