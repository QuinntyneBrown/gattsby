import { StoreError } from '../store/store-error';
import type { ToolContext } from '../tools/tool-context';
import type { ToolDefinition } from '../tools/tool-definition';
import { ToolError } from '../tools/tool-error';
import { fail, normaliseSummary, type ToolResult } from '../tools/tool-result';

/** Thrown for a defect: a throw that is not a refusal. The loop ends with the reason `failure`. */
export class ToolDefect extends Error {
  constructor(
    readonly tool: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause));
    this.name = 'ToolDefect';
  }
}

/**
 * Runs one tool and returns its envelope; no refusal escapes (FR-072; return-a-result-envelope
 * design). Preconditions are checked first. `handedOut` lists the evidence IDs the context gave
 * out during the call, which the envelope's evidence always includes.
 */
export async function executeTool(
  tool: ToolDefinition,
  input: unknown,
  ctx: ToolContext,
  handedOut: () => readonly string[],
): Promise<ToolResult<unknown>> {
  for (const precondition of tool.preconditions) {
    if (!precondition.check(ctx)) return fail(precondition.code, precondition.message);
  }
  let result: ToolResult<unknown>;
  try {
    result = await tool.run(input, ctx);
  } catch (error) {
    if (error instanceof ToolError) {
      result = fail(error.code, error.message);
    } else if (error instanceof StoreError && error.code === 'STORAGE_FULL') {
      result = fail('STORAGE_FULL', error.message);
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      result = fail('ABORTED', 'The step was stopped.');
    } else {
      throw new ToolDefect(tool.name, error);
    }
  }
  const evidence = [...new Set([...result.evidence, ...handedOut()])];
  return result.ok
    ? { ...result, summary: normaliseSummary(result.summary), evidence }
    : { ...result, summary: normaliseSummary(result.summary), data: null, evidence };
}
