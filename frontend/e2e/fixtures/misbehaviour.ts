import type { Page } from '@playwright/test';

// Makes the page do what Gattsby must never do, or what only the BLE layer and the model adapter
// may do, so a spec can prove each guard trips. Used only by the guard specs.
export class Misbehaviour {
  constructor(private readonly page: Page) {}

  async requestAnyDevice(): Promise<void> {
    await this.page.evaluate(() =>
      navigator.bluetooth.requestDevice({ acceptAllDevices: true }).catch(() => undefined),
    );
  }

  /** Picks the device that advertises `service`, writes `bytes` and returns the indication. */
  async writeToCharacteristic(
    service: string,
    characteristic: string,
    bytes: number[],
  ): Promise<number[] | null> {
    return this.page.evaluate(
      async ({ service, characteristic, bytes }) => {
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [service] }],
        });
        const server = await device.gatt!.connect();
        const target = await (
          await server.getPrimaryService(service)
        ).getCharacteristic(characteristic);
        const indicated = new Promise<number[] | null>((resolve) => {
          if (!target.properties.indicate && !target.properties.notify) resolve(null);
          target.addEventListener(
            'characteristicvaluechanged',
            () => resolve([...new Uint8Array(target.value!.buffer)]),
            { once: true },
          );
        });
        await target.startNotifications().catch(() => undefined);
        await target.writeValueWithResponse(Uint8Array.from(bytes));
        return indicated;
      },
      { service, characteristic, bytes },
    );
  }

  /** Picks the device that advertises `service` and keeps the last notification it sends. */
  async subscribe(service: string, characteristic: string): Promise<void> {
    await this.page.evaluate(
      async ({ service, characteristic }) => {
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [service] }],
        });
        const server = await device.gatt!.connect();
        const target = await (
          await server.getPrimaryService(service)
        ).getCharacteristic(characteristic);
        target.addEventListener('characteristicvaluechanged', () => {
          (globalThis as unknown as { __last: number[] }).__last = [
            ...new Uint8Array(target.value!.buffer),
          ];
        });
        await target.startNotifications();
      },
      { service, characteristic },
    );
  }

  lastNotification(): Promise<number[]> {
    return this.page.evaluate(() => (globalThis as unknown as { __last: number[] }).__last);
  }

  async promptModel(input: string): Promise<string> {
    return this.page.evaluate(async (text) => {
      const model = (
        globalThis as unknown as {
          LanguageModel: { create(): Promise<{ prompt(input: string): Promise<string> }> };
        }
      ).LanguageModel;
      const session = await model.create();
      return session.prompt(text).catch((error: Error) => `rejected: ${error.name}`);
    }, input);
  }

  async openOffLocalhost(): Promise<void> {
    await this.page.goto('https://example.com/').catch(() => undefined);
  }

  async throwUncaught(): Promise<void> {
    // An exception in an event listener is reported to the page as uncaught, not to the caller.
    await this.page.evaluate(() => {
      const target = new EventTarget();
      target.addEventListener('misbehave', () => {
        throw new Error('Uncaught on purpose');
      });
      target.dispatchEvent(new Event('misbehave'));
    });
  }

  /** Returns true when the browser refused the string (Trusted Types). */
  async assignInnerHtml(markup: string): Promise<boolean> {
    return this.page.evaluate((text) => {
      try {
        // eslint-disable-next-line no-restricted-syntax -- the probe Trusted Types must refuse
        document.body.innerHTML = text;
        return false;
      } catch {
        return true;
      }
    }, markup);
  }

  async askForLocation(): Promise<void> {
    await this.page.evaluate(() => navigator.geolocation.getCurrentPosition(() => undefined));
  }

  async openAlert(): Promise<void> {
    await this.page.evaluate(() => alert('Hello'));
  }
}
