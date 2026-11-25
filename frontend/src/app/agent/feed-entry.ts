import type { ObservationTag } from '../store/model/observation';
import type { Stage } from '../store/model/stage';

// One item of the activity feed (follow-the-investigation design).
export type FeedEntry =
  | {
      readonly kind: 'stageStart';
      readonly id: string;
      readonly stage: Stage;
      readonly title: string;
    }
  | {
      readonly kind: 'message';
      readonly id: string;
      readonly speaker: 'agent' | 'checklist' | 'person';
      readonly text: string;
      readonly why: string | null;
    }
  | {
      readonly kind: 'tool';
      readonly id: string;
      readonly tool: string;
      readonly purpose: string;
      readonly durationMs: number | null;
      readonly summary: string | null;
      readonly failed: boolean;
      readonly running: boolean;
      readonly observations: readonly { readonly text: string; readonly tag: ObservationTag }[];
    }
  | {
      readonly kind: 'hypothesis';
      readonly id: string;
      readonly label: string;
      readonly from: number;
      readonly to: number;
      readonly word: string;
    };
