import type { ErrorCode } from './error-code';

export interface ToolErrorInfo {
  readonly code: ErrorCode;
  readonly message: string;
}

// The common result envelope every tool returns (FR-072).
export type ToolResult<O> =
  | {
      readonly ok: true;
      readonly summary: string;
      readonly data: O;
      readonly error: null;
      readonly evidence: readonly string[];
    }
  | {
      readonly ok: false;
      readonly summary: string;
      readonly data: null;
      readonly error: ToolErrorInfo;
      readonly evidence: readonly string[];
    };

const MAX_SUMMARY = 200;

/** One line of at most 200 characters (FR-044, FR-072). */
export function normaliseSummary(summary: string): string {
  const line = summary.replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return line.length > MAX_SUMMARY ? `${line.slice(0, MAX_SUMMARY - 1)}…` : line;
}

export function ok<O>(summary: string, data: O, evidence: readonly string[] = []): ToolResult<O> {
  return { ok: true, summary: normaliseSummary(summary), data, error: null, evidence };
}

export function fail<O = never>(
  code: ErrorCode,
  message: string,
  summary: string = message,
  evidence: readonly string[] = [],
): ToolResult<O> {
  return {
    ok: false,
    summary: normaliseSummary(summary),
    data: null,
    error: { code, message },
    evidence,
  };
}
