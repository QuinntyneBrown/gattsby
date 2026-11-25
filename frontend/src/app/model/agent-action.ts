import type { UpdateHypothesisInput } from '../tools/meta/update-hypothesis.tool';
import type { VerdictKind } from '../store/model/verdict';

export type AgentAction =
  | {
      readonly type: 'call_tool';
      readonly tool: string;
      readonly input: Record<string, unknown>;
      readonly why?: string;
    }
  | {
      readonly type: 'ask_user';
      readonly question: string;
      readonly answers: readonly string[];
      readonly why: string;
      readonly allowFreeText?: boolean;
    }
  | ({ readonly type: 'update_hypothesis' } & UpdateHypothesisInput)
  | {
      readonly type: 'request_missing_tool';
      readonly capability: string;
      readonly reason: string;
      readonly evidence: readonly string[];
    }
  | {
      readonly type: 'finish';
      readonly verdict: Exclude<VerdictKind, 'stoppedByPerson'>;
      readonly summary: string;
    };
