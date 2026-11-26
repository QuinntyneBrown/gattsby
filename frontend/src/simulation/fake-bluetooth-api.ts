import { canonicalUuid } from './bluetooth-uuid';
import { FakeBluetoothDevice } from './fake-bluetooth-device';
import { notScripted } from './not-scripted';
import type { ScriptedDevice } from './scripted-device';
import type { BluetoothScript, ChooserStep } from './simulation-config';
import type { Report } from './simulation-event';

// The parts of navigator.bluetooth the BLE layer uses, playing scripted devices
// (simulate-devices-and-model design). Every call is reported; a call the script does not cover
// is reported as unexpected and rejected.
export class FakeBluetoothApi extends EventTarget {
  private readonly devices: FakeBluetoothDevice[];
  private readonly chooser: ChooserStep[];
  private readonly granted = new Set<FakeBluetoothDevice>();
  private available: boolean;

  constructor(
    scripted: readonly ScriptedDevice[],
    private readonly script: BluetoothScript,
    private readonly report: Report,
  ) {
    super();
    this.available = script.available ?? true;
    this.chooser = [...script.chooser];
    this.devices = scripted.map(
      (device) =>
        new FakeBluetoothDevice(
          device,
          { effort: 0, ticks: 0, values: {} },
          report,
          script.readDelays,
        ),
    );
    for (const device of this.devices) {
      if (!script.permittedCandidates?.includes(device.script.id)) continue;
      device.grant(new Set(device.script.services.map(({ uuid }) => canonicalUuid(uuid))));
      this.granted.add(device);
    }
  }

  /** The person's effort, for every device (0 = still, 1 = walking or pedalling, 2 = faster). */
  setEffort(effort: number): void {
    this.devices.forEach((device) => (device.state.effort = effort));
  }

  /** The incline the person sets on the console, in percent. */
  setIncline(percent: number): void {
    this.devices.forEach((device) => (device.state.values['incline'] = percent));
  }

  setAdvertising(deviceId: string, on: boolean): void {
    const device = this.devices.find((candidate) => candidate.script.id === deviceId);
    if (device) device.state.values['advertisingOff'] = on ? 0 : 1;
  }

  dropConnection(failures: number): void {
    this.devices.find(({ gatt }) => gatt.connected)?.gatt.drop(failures);
  }

  async getAvailability(): Promise<boolean> {
    this.report({ kind: 'bluetooth-call', method: 'getAvailability', detail: '' });
    return this.available;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  async getDevices(): Promise<FakeBluetoothDevice[]> {
    this.report({ kind: 'bluetooth-call', method: 'getDevices', detail: '' });
    return [...this.granted];
  }

  async requestDevice(options?: RequestDeviceOptions): Promise<FakeBluetoothDevice> {
    this.report({
      kind: 'bluetooth-call',
      method: 'requestDevice',
      detail: JSON.stringify(options ?? {}),
    });
    const hasFilters = !!options && 'filters' in options && options.filters !== undefined;
    const acceptAll = !!options && 'acceptAllDevices' in options && options.acceptAllDevices;
    if (hasFilters === !!acceptAll) {
      throw new TypeError(
        "Either 'filters' should be present or 'acceptAllDevices' should be true, but not both.",
      );
    }
    const step = this.chooser.shift();
    if (!step) {
      return this.unexpected('requestDevice with no chooser step left');
    }
    if ('cancel' in step) {
      throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError');
    }
    const device = this.devices.find((candidate) => candidate.script.id === step.pick);
    const filters = hasFilters ? (options as { filters: BluetoothLEScanFilter[] }).filters : [];
    if (!device || (!acceptAll && !filters.some((filter) => matches(device.script, filter)))) {
      return this.unexpected(`chooser picked ${step.pick}, which the chooser would not list`);
    }
    const services = new Set(
      [
        ...filters.flatMap((filter) => filter.services ?? []),
        ...(options?.optionalServices ?? []),
        ...(this.script.permittedServices ?? []),
      ].map(canonicalUuid),
    );
    device.grant(services);
    this.granted.add(device);
    return device;
  }

  async requestLEScan(): Promise<{ stop(): void }> {
    if (!this.script.advertisementScanning) return this.unexpected('requestLEScan');
    this.report({ kind: 'bluetooth-call', method: 'requestLEScan', detail: '' });
    const interval = setInterval(() => {
      for (const device of this.granted) {
        const advertisement = device.advertisement();
        if (advertisement) this.dispatchEvent(advertisement);
      }
    }, 1_000);
    return {
      stop: () => {
        clearInterval(interval);
        this.report({ kind: 'bluetooth-call', method: 'stopLEScan', detail: '' });
      },
    };
  }

  private async unexpected(detail: string): Promise<never> {
    this.report({ kind: 'unexpected-bluetooth', detail });
    throw notScripted(detail);
  }
}

function matches(device: ScriptedDevice, filter: BluetoothLEScanFilter): boolean {
  const advertised = new Set(device.advertisedServices.map(canonicalUuid));
  const services = (filter.services ?? []).map(canonicalUuid);
  const name = device.name ?? '';
  return (
    services.every((service) => advertised.has(service)) &&
    (filter.name === undefined || filter.name === name) &&
    (filter.namePrefix === undefined || (name !== '' && name.startsWith(filter.namePrefix)))
  );
}
