// The parts of Chrome's Prompt API (`LanguageModel`) the model adapter uses. The browser's own
// type definitions do not include it yet.
export type LanguageModelAvailability =
  'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface LanguageModelApi {
  availability(options?: object): Promise<LanguageModelAvailability>;
  create(options?: {
    monitor?: (monitor: EventTarget) => void;
    signal?: AbortSignal;
    initialPrompts?: readonly object[];
    expectedInputs?: readonly { type: 'text' | 'image' | 'audio'; languages?: readonly string[] }[];
    expectedOutputs?: readonly { type: 'text'; languages?: readonly string[] }[];
  }): Promise<LanguageModelSessionApi>;
}

export interface LanguageModelSessionApi {
  readonly inputQuota?: number;
  readonly inputUsage?: number;
  readonly contextWindow?: number;
  readonly contextUsage?: number;
  measureContextUsage?(input: string, options?: { responseConstraint?: object }): Promise<number>;
  measureInputUsage?(input: string): Promise<number>;
  clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSessionApi>;
  prompt(
    input: string,
    options?: { signal?: AbortSignal; responseConstraint?: object },
  ): Promise<string>;
  destroy(): void;
}
