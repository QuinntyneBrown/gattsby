import { join } from 'node:path';
import { buildSync } from 'esbuild';
import type { Page } from '@playwright/test';
import type { SimulationConfig } from '../../src/simulation/simulation-config';
import type { SimulationEvent } from '../../src/simulation/simulation-event';
import type { SimulationRecorder } from './simulation-recorder';

let bundle: string | undefined;

// The fakes, bundled once per worker from src/simulation/install-fakes.ts.
function fakesBundle(): string {
  bundle ??= buildSync({
    entryPoints: [join(__dirname, '..', '..', 'src', 'simulation', 'install-fakes.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    write: false,
  }).outputFiles[0].text;
  return bundle;
}

/** Installs the fake Bluetooth API and the fake model before any page script runs. */
export async function installFakes(
  page: Page,
  config: SimulationConfig,
  recorder: SimulationRecorder,
): Promise<void> {
  await page.exposeFunction('__gattsbyReport', (event: SimulationEvent) => recorder.add(event));
  await page.addInitScript({
    content: `${fakesBundle()}\n__gattsbyInstallFakes(${JSON.stringify(config)});`,
  });
}

// What a spec can do with the fake Bluetooth API and read from it.
export class FakeBluetooth {
  constructor(
    private readonly page: Page,
    private readonly recorder: SimulationRecorder,
  ) {}

  async setAvailable(available: boolean): Promise<void> {
    await this.page.evaluate((value) => {
      const globals = globalThis as unknown as {
        __gattsbyFakes: { setBluetoothAvailable(v: boolean): void };
      };
      globals.__gattsbyFakes.setBluetoothAvailable(value);
    }, available);
  }

  async setAdvertising(id: string, on: boolean): Promise<void> {
    await this.page.evaluate(
      ({ id, on }) => {
        const globals = globalThis as unknown as {
          __gattsbyFakes: { setAdvertising(deviceId: string, enabled: boolean): void };
        };
        globals.__gattsbyFakes.setAdvertising(id, on);
      },
      { id, on },
    );
  }

  /** The person's effort: 0 = still, 1 = walking or pedalling, 2 = faster. */
  async setEffort(effort: number): Promise<void> {
    await this.page.evaluate(
      (value) =>
        (
          globalThis as unknown as { __gattsbyFakes: { setEffort(e: number): void } }
        ).__gattsbyFakes.setEffort(value),
      effort,
    );
  }

  /** Changes the simulated console incline without a GATT write. */
  async setIncline(percent: number): Promise<void> {
    await this.page.evaluate(
      (value) =>
        (
          globalThis as unknown as { __gattsbyFakes: { setIncline(percent: number): void } }
        ).__gattsbyFakes.setIncline(value),
      percent,
    );
  }

  /** The options of every `requestDevice` call, in order. */
  requestDeviceOptions(): RequestDeviceOptions[] {
    return this.recorder.events.flatMap(({ event }) =>
      event.kind === 'bluetooth-call' && event.method === 'requestDevice'
        ? [JSON.parse(event.detail) as RequestDeviceOptions]
        : [],
    );
  }

  calls(): string[] {
    return this.recorder.events.flatMap(({ event }) =>
      event.kind === 'bluetooth-call' ? [event.method] : [],
    );
  }

  writes() {
    return this.recorder.writes();
  }
}
