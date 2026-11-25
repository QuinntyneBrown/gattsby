import type { ModelSession } from '../model/model-session';
import { Clock } from '../shared/clock';
import type { ModelDecision } from '../store/model/model-decision';
import { ToolError } from '../tools/tool-error';
import { visibleTools } from '../tools/tool-list-generator';
import { validateModelAction } from './action-validator';
import type { ModelDecisionContext } from './model-decision-context';
import { composePrompt } from './prompt-composer';
import type { RuleAction } from './rule-outcome';

const MAX_RESPONSE = 8192;

export class ModelDecider {
  constructor(private readonly clock: Clock) {}

  async decide(
    session: ModelSession,
    ctx: ModelDecisionContext,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<
    { decision: ModelDecision; action: RuleAction } | { decision: ModelDecision; error: ToolError }
  > {
    const starting = this.clock.now();
    const call = new AbortController();
    let rawText: string | undefined;
    let promptTokens: number | null = null;
    const decision = (): ModelDecision => ({
      startedAt: starting,
      promptTokens,
      modelMs: Math.max(0, this.clock.now() - starting),
      ...(rawText === undefined ? {} : { rawText }),
    });
    const abort = () => call.abort(new ToolError('ABORTED', 'The model decision was stopped.'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const stopTimer = this.clock.setTimeout(
      () => call.abort(new ToolError('TIMEOUT', 'The on-device model did not answer in time.')),
      timeoutMs,
    );
    let interrupt: (() => void) | undefined;
    try {
      call.signal.throwIfAborted();
      const stopped = new Promise<never>((_, reject) => {
        interrupt = () => reject(call.signal.reason);
        call.signal.addEventListener('abort', interrupt, { once: true });
      });
      const choose = async () => {
        const tools = visibleTools(ctx.registry, ctx.outcome.stage, ctx.capabilities);
        const prompt = await composePrompt(ctx, tools, session);
        call.signal.throwIfAborted();
        promptTokens = prompt.tokens;
        const answer = await session.ask(prompt.prompt, prompt.responseConstraint, call.signal);
        call.signal.throwIfAborted();
        rawText = answer.slice(0, MAX_RESPONSE);
        if (answer.length > MAX_RESPONSE)
          throw new ToolError('INVALID_INPUT', 'The model action was too long.');
        return validateModelAction(parse(answer), ctx);
      };
      const action = await Promise.race([choose(), stopped]);
      return { decision: decision(), action };
    } catch (error) {
      return {
        decision: decision(),
        error:
          error instanceof ToolError
            ? error
            : new ToolError('MODEL_SESSION_FAILED', 'The on-device model session stopped.'),
      };
    } finally {
      stopTimer();
      if (interrupt) call.signal.removeEventListener('abort', interrupt);
      signal.removeEventListener('abort', abort);
    }
  }
}

function parse(answer: string): unknown {
  try {
    return JSON.parse(answer, (key, value: unknown) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('Invalid JSON key');
      return value;
    });
  } catch {
    throw new ToolError('INVALID_INPUT', 'The model did not return one JSON action.');
  }
}
