// A session owned by one investigation. Only the adapter uses Chrome's session object.
export interface ModelSession {
  readonly promptBudget: number;
  measure(prompt: string, schema: object): Promise<number>;
  ask(prompt: string, schema: object, signal: AbortSignal): Promise<string>;
  destroy(): void;
}
