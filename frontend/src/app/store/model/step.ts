import type { ToolResult } from '../../tools/tool-result';
import type { Stage } from './stage';
import type { StepError } from './step-error';

export interface StepPersonExchange {
  readonly prompt: string;
  readonly why?: string | null;
  readonly answer: string;
  readonly skipped: boolean;
}

// One completed step: the action run and its result envelope (save-as-the-investigation-runs
// design). Its evidence ID is `s-` and its number.
export interface Step {
  readonly investigationId: string;
  readonly n: number;
  readonly id: string;
  readonly stage: Stage;
  readonly tool: string;
  readonly input: unknown;
  readonly decidedBy: 'rules' | 'model' | 'checklist' | 'orchestrator';
  readonly ruleId: string | null;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly status: 'completed' | 'failed' | 'refused' | 'interrupted';
  readonly result: ToolResult<unknown>;
  /** What the agent said before the step, shown in the feed. */
  readonly message: { readonly text: string; readonly why?: string } | null;
  readonly exchange: StepPersonExchange | null;
  readonly error: StepError | null;
}
