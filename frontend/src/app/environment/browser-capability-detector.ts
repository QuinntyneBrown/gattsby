import { inject, Injectable, Injector } from '@angular/core';
import { BleLayer } from '../ble/ble-layer';
import { InvestigationStore } from '../store/investigation-store';
import type { Capabilities } from './capabilities';
import { CapabilityDetector } from './capability-detector';

const PROBE_LIMIT_MS = 1000;

// Asks each adapter for its availability, in parallel, each within 1 s (check-capabilities
// design). Prompts for nothing.
@Injectable()
export class BrowserCapabilityDetector extends CapabilityDetector {
  private readonly ble = inject(BleLayer);
  private readonly store = inject(InvestigationStore);
  private readonly injector = inject(Injector);

  async detect(): Promise<Capabilities> {
    const [ble, model, storage, camera] = await Promise.all([
      probe(() => this.ble.availability(), {
        api: false,
        adapterAvailable: false,
        blocked: false,
        watchAdvertisements: false,
        requestLEScan: false,
        getDevices: false,
      }),
      probe(
        async () => {
          const { PromptApiModelAdapter } = await import('../model/prompt-api-model-adapter');
          return this.injector.get(PromptApiModelAdapter).availability();
        },
        { api: false, availability: 'unavailable' as const, imageInput: false },
      ),
      probe(() => this.store.usage(), {
        open: false,
        persisted: false,
        quotaBytes: 0,
        usageBytes: 0,
      }),
      probe(async () => {
        const { cameraAvailable } = await import('../photo/media-devices-camera-adapter');
        return cameraAvailable();
      }, false),
    ]);
    return {
      secureContext: typeof isSecureContext === 'boolean' ? isSecureContext : false,
      bluetooth: { api: ble.api, adapterAvailable: ble.adapterAvailable, blocked: ble.blocked },
      model,
      watchAdvertisements: ble.watchAdvertisements,
      requestLEScan: ble.requestLEScan,
      getDevices: ble.getDevices,
      camera,
      storage,
      platform: platform(),
    };
  }
}

function probe<T>(run: () => Promise<T> | T, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), PROBE_LIMIT_MS);
    Promise.resolve()
      .then(run)
      .then(
        (value) => resolve(value),
        () => resolve(fallback),
      )
      .finally(() => clearTimeout(timer));
  });
}

function platform(): Capabilities['platform'] {
  const data = (
    navigator as Navigator & {
      userAgentData?: {
        mobile: boolean;
        platform: string;
        brands: { brand: string; version: string }[];
      };
    }
  ).userAgentData;
  const chrome = data?.brands.find((b) => /Chrom/.test(b.brand));
  return {
    os: data?.platform ?? navigator.platform ?? 'unknown',
    browser: chrome?.brand ?? 'unknown',
    version: chrome?.version ?? 'unknown',
    mobile: data?.mobile ?? /Mobi/.test(navigator.userAgent),
  };
}
