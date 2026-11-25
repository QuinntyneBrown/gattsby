import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { BleLayer } from '../ble/ble-layer';
import { LANGUAGE_MODEL } from '../model/language-model.token';
import { InvestigationStore } from '../store/investigation-store';
import { BrowserCapabilityDetector } from './browser-capability-detector';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

it('handles a rejected probe and a probe that never settles within the same second', async () => {
  vi.useFakeTimers();
  const persist = vi.fn(async () => undefined);
  TestBed.configureTestingModule({
    providers: [
      BrowserCapabilityDetector,
      { provide: BleLayer, useValue: { availability: async () => new Promise(() => undefined) } },
      {
        provide: LANGUAGE_MODEL,
        useValue: {
          availability: async () => {
            throw new DOMException('Test browser refusal', 'NotSupportedError');
          },
        },
      },
      {
        provide: InvestigationStore,
        useValue: {
          usage: async () => ({ open: true, persisted: false, quotaBytes: 1, usageBytes: 0 }),
          recordCapabilityDiagnostics: persist,
        },
      },
    ],
  });
  const detection = TestBed.inject(BrowserCapabilityDetector).detect();
  // Resolve the dynamic imports so the fake model's rejection wins over the one-second fallback.
  await import('../model/prompt-api-model-adapter');
  await import('../photo/media-devices-camera-adapter');
  await vi.advanceTimersByTimeAsync(1000);
  const result = await detection;
  expect(result.bluetooth.api).toBe(false);
  expect(result.model.availability).toBe('unavailable');
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ capability: 'bluetooth', code: 'CAPABILITY_TIMEOUT' }),
      expect.objectContaining({ capability: 'model', code: 'NotSupportedError' }),
    ]),
  );
  expect(persist).toHaveBeenCalledOnce();
  expect(persist).toHaveBeenCalledWith(result.diagnostics);
});
