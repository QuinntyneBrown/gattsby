import { FakeGattServer } from './fake-gatt-server';
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
    report: Report,
  ) {
    super();
    this.id = `sim-${script.id}`;
    this.name = script.name ?? undefined;
    this.gatt = new FakeGattServer(this, script, state, () => this.allowed, report);
  }

  /** Called by requestDevice: the services this origin may reach from now on. */
  grant(services: ReadonlySet<string>): void {
    this.allowed = new Set([...this.allowed, ...services]);
  }

  async forget(): Promise<void> {
    this.allowed = new Set();
    this.gatt.disconnect();
  }
}
