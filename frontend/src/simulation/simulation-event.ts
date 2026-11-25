// What the fakes report to whoever installed them (the Playwright fixture), one event at a time.
export type SimulationEvent =
  | { readonly kind: 'bluetooth-call'; readonly method: string; readonly detail: string }
  | {
      readonly kind: 'write';
      readonly device: string;
      readonly service: string;
      readonly characteristic: string;
      readonly bytes: readonly number[];
      readonly withResponse: boolean;
    }
  | { readonly kind: 'unexpected-bluetooth'; readonly detail: string }
  | { readonly kind: 'model-call'; readonly method: string }
  | { readonly kind: 'model-prompt'; readonly input: string; readonly constraint?: unknown }
  | { readonly kind: 'unexpected-model'; readonly detail: string }
  | { readonly kind: 'geolocation'; readonly detail: string }
  | { readonly kind: 'csp-violation'; readonly detail: string };

export type Report = (event: SimulationEvent) => void;
