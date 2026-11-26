import { FakeGattServer } from './fake-gatt-server';
import { canonicalUuid } from './bluetooth-uuid';
import type { ScriptedDevice } from './scripted-device';
import type { Report } from './simulation-event';
import type { SimulationState } from './simulation-state';

// The parts of BluetoothDevice the BLE layer uses. `watchAdvertisements` is absent, as on the
// mocks' MacBook, where advertisement scanning is not available.
export class FakeBluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name: string | undefined;
  readonly gatt: FakeGattServer;
  private allowed: ReadonlySet<string> = new Set();

  constructor(
    readonly script: ScriptedDevice,
    readonly state: SimulationState,
    private readonly report: Report,
    readDelays: Readonly<Record<string, number>> = {},
  ) {
    super();
    this.id = `sim-${script.id}`;
    this.name = script.name ?? undefined;
    this.gatt = new FakeGattServer(this, script, state, () => this.allowed, report, readDelays);
  }

  /** Called by requestDevice: the services this origin may reach from now on. */
  grant(services: ReadonlySet<string>): void {
    this.allowed = new Set([...this.allowed, ...services]);
  }

  async forget(): Promise<void> {
    this.allowed = new Set();
    this.gatt.disconnect();
  }

  async watchAdvertisements({ signal }: { signal: AbortSignal }): Promise<void> {
    signal.throwIfAborted();
    this.report({ kind: 'bluetooth-call', method: 'watchAdvertisements', detail: this.id });
    const interval = setInterval(() => {
      const advertisement = this.advertisement();
      if (advertisement) this.dispatchEvent(advertisement);
    }, 1_000);
    signal.addEventListener(
      'abort',
      () => {
        clearInterval(interval);
        this.report({ kind: 'bluetooth-call', method: 'stopAdvertisements', detail: this.id });
      },
      { once: true },
    );
  }

  advertisement(): Event | null {
    if (this.state.values['advertisingOff']) return null;
    return Object.assign(new Event('advertisementreceived'), {
      device: this,
      uuids: this.script.advertisedServices.map(canonicalUuid),
      rssi: -52,
      txPower: -6,
      manufacturerData: new Map([[0x0102, new DataView(Uint8Array.from([0xa1, 0xb2]).buffer)]]),
      serviceData: new Map(),
    });
  }
}
