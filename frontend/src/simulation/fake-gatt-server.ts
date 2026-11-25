import { canonicalUuid } from './bluetooth-uuid';
import { FakeGattService } from './fake-gatt-service';
import type { ScriptedDevice } from './scripted-device';
import type { Report } from './simulation-event';
import type { SimulationState } from './simulation-state';

// The parts of BluetoothRemoteGATTServer the BLE layer uses. Only the services the page named
// in `requestDevice` (filters or optionalServices) may be reached, as in Chrome.
export class FakeGattServer {
  connected = false;
  private readonly services: FakeGattService[];
  private readonly stoppers: (() => void)[] = [];

  constructor(
    readonly device: EventTarget,
    script: ScriptedDevice,
    state: SimulationState,
    private readonly allowedServices: () => ReadonlySet<string> | 'all',
    private readonly report: Report,
  ) {
    this.services = script.services.map(
      (service) =>
        new FakeGattService(
          device,
          service,
          {
            report,
            state,
            deviceName: script.name ?? script.id,
            isConnected: () => this.connected,
            onDisconnect: (stop) => this.stoppers.push(stop),
          },
          report,
        ),
    );
  }

  async connect(): Promise<this> {
    this.report({ kind: 'bluetooth-call', method: 'connect', detail: '' });
    this.connected = true;
    return this;
  }

  disconnect(): void {
    this.report({ kind: 'bluetooth-call', method: 'disconnect', detail: '' });
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.stoppers.forEach((stop) => stop());
    this.device.dispatchEvent(new Event('gattserverdisconnected'));
  }

  async getPrimaryService(uuid: number | string): Promise<FakeGattService> {
    const wanted = canonicalUuid(uuid);
    this.report({ kind: 'bluetooth-call', method: 'getPrimaryService', detail: wanted });
    this.requireAccess(wanted);
    const found = this.services.find((service) => service.uuid === wanted);
    if (!found) {
      throw new DOMException(
        `No Services matching UUID ${wanted} found in Device.`,
        'NotFoundError',
      );
    }
    return found;
  }

  async getPrimaryServices(uuid?: number | string): Promise<FakeGattService[]> {
    const wanted = uuid === undefined ? undefined : canonicalUuid(uuid);
    this.report({ kind: 'bluetooth-call', method: 'getPrimaryServices', detail: wanted ?? '*' });
    this.requireConnection();
    if (wanted !== undefined) {
      this.requireAccess(wanted);
    }
    const allowed = this.allowedServices();
    const found = this.services.filter(
      (service) =>
        (wanted === undefined || service.uuid === wanted) &&
        (allowed === 'all' || allowed.has(service.uuid)),
    );
    if (found.length === 0) {
      throw new DOMException('No Services found in device.', 'NotFoundError');
    }
    return found;
  }

  private requireConnection(): void {
    if (!this.connected) {
      throw new DOMException('GATT Server is disconnected.', 'NetworkError');
    }
  }

  private requireAccess(uuid: string): void {
    this.requireConnection();
    const allowed = this.allowedServices();
    if (allowed !== 'all' && !allowed.has(uuid)) {
      throw new DOMException(
        `Origin is not allowed to access the service. Tip: Add the service UUID to 'optionalServices' in requestDevice() options.`,
        'SecurityError',
      );
    }
  }
}
