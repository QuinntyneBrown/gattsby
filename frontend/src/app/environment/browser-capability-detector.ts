import { inject, Injectable, Injector } from '@angular/core';
import { BleLayer } from '../ble/ble-layer';
import { Clock } from '../shared/clock';
import { InvestigationStore } from '../store/investigation-store';
import type { CapabilityDiagnostic } from './capability-diagnostic';
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
  private readonly clock = inject(Clock);

  async detect(options: { model?: boolean } = {}): Promise<Capabilities> {
    const diagnostics: CapabilityDiagnostic[] = [];
    const diagnose = (capability: CapabilityDiagnostic['capability'], code: string): void => {
      diagnostics.push({
        capability,
        code,
        tool: 'check_capabilities',
        stage: 'prepare',
        at: this.clock.now(),
      });
    };
    const [ble, model, storage, camera] = await Promise.all([
      this.probe(
        () => this.ble.availability(),
        {
          api: false,
          adapterAvailable: false,
          blocked: false,
          watchAdvertisements: false,
          requestLEScan: false,
          getDevices: false,
        },
        (code) => diagnose('bluetooth', code),
      ),
      options.model === false
        ? { api: false, availability: 'unavailable' as const, imageInput: false }
        : this.probe(
            async () => {
              const { PromptApiModelAdapter } = await import('../model/prompt-api-model-adapter');
              return this.injector.get(PromptApiModelAdapter).availability();
            },
            { api: false, availability: 'unavailable' as const, imageInput: false },
            (code) => diagnose('model', code),
          ),
      this.probe(
        () => this.store.usage(),
        {
          open: false,
          persisted: false,
          quotaBytes: 0,
          usageBytes: 0,
        },
        (code) => diagnose('storage', code),
      ),
      this.probe(
        async () => {
          const { cameraAvailable } = await import('../photo/media-devices-camera-adapter');
          return cameraAvailable();
        },
        false,
        (code) => diagnose('camera', code),
      ),
    ]);
    if (!storage.open && !diagnostics.some(({ capability }) => capability === 'storage')) {
      diagnose('storage', 'STORAGE_UNAVAILABLE');
    }
    if (diagnostics.length && storage.open) {
      void this.store.recordCapabilityDiagnostics(diagnostics).catch(() => undefined);
    }
    return {
      ...(diagnostics.length ? { diagnostics } : {}),
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

  private probe<T>(
    run: () => Promise<T> | T,
    fallback: T,
    diagnose: (code: string) => void,
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      let settled = false;
      const finish = (value: T, code?: string): void => {
        if (settled) return;
        settled = true;
        cancel();
        if (code) diagnose(code);
        resolve(value);
      };
      const cancel = this.clock.setTimeout(
        () => finish(fallback, 'CAPABILITY_TIMEOUT'),
        PROBE_LIMIT_MS,
      );
      void Promise.resolve()
        .then(run)
        .then(
          (value) => finish(value),
          (error: unknown) =>
            finish(
              fallback,
              error instanceof Error || error instanceof DOMException
                ? error.name
                : 'CAPABILITY_FAILED',
            ),
        );
    });
  }
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
  const agent = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(agent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const firefox = /(?:Firefox|FxiOS)\/(\d+)/.exec(agent);
  const chrome = /(?:Chrome|CriOS)\/(\d+)/.exec(agent);
  const edge = /(?:Edg|EdgiOS|EdgA)\/(\d+)/.exec(agent);
  const chromium = data?.brands.find((b) => /Chrom/.test(b.brand));
  const browser = edge
    ? 'Edge'
    : firefox
      ? 'Firefox'
      : chrome || (chromium && !ios)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'unknown';
  return {
    os: ios
      ? 'iOS'
      : data?.platform || (/Android/.test(agent) ? 'Android' : navigator.platform) || 'unknown',
    browser,
    version: (edge ?? firefox ?? chrome)?.[1] ?? chromium?.version ?? 'unknown',
    mobile: ios || (data?.mobile ?? /Mobi/.test(agent)),
  };
}
