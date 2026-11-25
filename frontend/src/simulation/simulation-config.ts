// What a spec (or a demonstration) scripts: the devices nearby, what Chrome's chooser does, and
// what the model says. Plain JSON, so the Playwright fixture can pass it into the page.

/** One `requestDevice` call: pick a scripted device by id, or cancel the chooser. */
export type ChooserStep = { readonly pick: string } | { readonly cancel: true };

export interface BluetoothScript {
  readonly advertisementScanning?: boolean;
  /** What `getAvailability()` reports; true when omitted. */
  readonly available?: boolean;
  /** Ids of the scripted devices nearby. */
  readonly devices: readonly string[];
  /** One step per expected `requestDevice` call, in order. */
  readonly chooser: readonly ChooserStep[];
  /** Milliseconds a read of a characteristic (canonical UUID) takes, on the page's clock. */
  readonly readDelays?: Readonly<Record<string, number>>;
  /** Notification periods keyed by canonical characteristic UUID. */
  readonly notificationPeriods?: Readonly<Record<string, number>>;
}

export type ModelAvailability =
  'available' | 'downloadable' | 'downloading' | 'unavailable' | 'absent';

/** One `prompt` call: an action to return as JSON, or an error to reject with. */
export type ScriptedResponse =
  | { readonly action: unknown; readonly delayMs?: number }
  | { readonly error: string; readonly message?: string; readonly delayMs?: number };

export interface ModelScript {
  readonly availability: ModelAvailability;
  readonly responses: readonly ScriptedResponse[];
}

export interface SimulationConfig {
  readonly bluetooth: BluetoothScript;
  readonly model: ModelScript;
}
