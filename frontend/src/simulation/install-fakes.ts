// The entry point the Playwright fixture bundles with esbuild and runs before the app loads
// (e2e/fixtures/fake-bluetooth.ts). It installs the fake Bluetooth API and the fake model, stubs
// geolocation, and reports Content Security Policy violations. Each report goes to the binding
// `__gattsbyReport` that the fixture exposes, so the records survive a reload.

import { FakeBluetoothApi } from './fake-bluetooth-api';
import { canonicalUuid } from './bluetooth-uuid';
import { FakeLanguageModel } from './fake-language-model';
import { SCRIPTED_DEVICES } from './scripted-devices';
import type { SimulationConfig } from './simulation-config';
import type { Report, SimulationEvent } from './simulation-event';

interface SimulationGlobals {
  __gattsbyReport?: (event: SimulationEvent) => unknown;
  __gattsbyFakes?: { setEffort(effort: number): void; setIncline(percent: number): void };
  LanguageModel?: unknown;
}

function install(config: SimulationConfig): void {
  const globals = globalThis as unknown as SimulationGlobals;
  const report: Report = (event) => void globals.__gattsbyReport?.(event);

  const devices = config.bluetooth.devices.map((id) => {
    const device = SCRIPTED_DEVICES[id];
    if (!device) {
      throw new Error(`No scripted device "${id}".`);
    }
    const periods = config.bluetooth.notificationPeriods;
    if (!periods) return device;
    return {
      ...device,
      services: device.services.map((service) => ({
        ...service,
        characteristics: service.characteristics.map((characteristic) => ({
          ...characteristic,
          notificationIntervalMs:
            periods[canonicalUuid(characteristic.uuid)] ?? characteristic.notificationIntervalMs,
        })),
      })),
    };
  });
  const bluetooth = new FakeBluetoothApi(devices, config.bluetooth, report);
  if (!config.bluetooth.advertisementScanning) {
    Object.defineProperty(bluetooth, 'requestLEScan', { value: undefined });
  }
  Object.defineProperty(Navigator.prototype, 'bluetooth', {
    configurable: true,
    get: () => bluetooth,
  });
  globals.__gattsbyFakes = {
    setEffort: (effort) => bluetooth.setEffort(effort),
    setIncline: (percent) => bluetooth.setIncline(percent),
  };

  delete globals.LanguageModel;
  if (config.model.availability !== 'absent') {
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: new FakeLanguageModel(config.model, report),
    });
  }

  const geolocation = navigator.geolocation;
  for (const method of ['getCurrentPosition', 'watchPosition'] as const) {
    Object.defineProperty(geolocation, method, {
      configurable: true,
      value: (_success: unknown, error?: (e: { code: number; message: string }) => void) => {
        report({ kind: 'geolocation', detail: method });
        error?.({ code: 1, message: 'Gattsby never asks for the location.' });
        return 0;
      },
    });
  }

  document.addEventListener('securitypolicyviolation', (event) => {
    report({
      kind: 'csp-violation',
      detail: `${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} at ${event.sourceFile}:${event.lineNumber}`,
    });
  });
}

(globalThis as unknown as { __gattsbyInstallFakes: typeof install }).__gattsbyInstallFakes =
  install;
