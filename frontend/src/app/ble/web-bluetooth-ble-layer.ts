import { inject, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { GattProperty } from '../knowledge-base/knowledge-base-data';
import type { NotificationDecoding } from '../store/model/notification-decoding';
import { canonicalUuid } from '../knowledge-base/uuid';
import { Clock } from '../shared/clock';
import { ToolError } from '../tools/tool-error';
import type { BleAvailability } from './ble-availability';
import { BleLayer, type ReadResult } from './ble-layer';
import { BLUETOOTH } from './bluetooth.token';
import type { ChosenDevice } from './chosen-device';
import type { ConnectionState, DisconnectEvent } from './connection-state';
import type { GattServiceInfo } from './gatt-layout';
import { bytesOf, toHex } from './hex-codec';
import { RawTrafficLog } from './raw-traffic-log';
import type { ScanRequest } from './scan-request';

const DISCONNECTED: ConnectionState = {
  status: 'disconnected',
  deviceId: null,
  deviceName: null,
  connectedAt: null,
};

const PROPERTIES: readonly GattProperty[] = [
  'read',
  'write',
  'writeWithoutResponse',
  'notify',
  'indicate',
];

// The BLE layer on Web Bluetooth (scan-for-the-device, connect-to-the-device,
// enumerate-the-gatt-layout and release-the-connection designs).
@Injectable()
export class WebBluetoothBleLayer extends BleLayer {
  private readonly bluetooth = inject(BLUETOOTH);
  private readonly clock = inject(Clock);
  private readonly log = inject(RawTrafficLog);
  private readonly devices = new Map<string, BluetoothDevice>();
  private readonly services = new Map<string, BluetoothRemoteGATTService>();
  private readonly subscriptions = new Map<string, () => Promise<void>>();
  private device: BluetoothDevice | null = null;
  private readonly state = signal<ConnectionState>(DISCONNECTED);
  private readonly disconnects = new Subject<DisconnectEvent>();
  readonly connection = this.state.asReadonly();
  readonly disconnected = this.disconnects.asObservable();

  private readonly onDisconnected = (event: Event): void => {
    const device = event.target as BluetoothDevice;
    const intentional = this.state().status === 'releasing';
    this.log.append({ kind: 'disconnect', direction: 'in', hex: '', detail: device.id });
    for (const stop of this.subscriptions.values()) void stop();
    device.removeEventListener('gattserverdisconnected', this.onDisconnected);
    this.services.clear();
    if (this.device === device) {
      this.device = null;
      this.state.set(DISCONNECTED);
    }
    this.disconnects.next({ deviceId: device.id, at: this.clock.now(), intentional });
  };

  async availability(): Promise<BleAvailability> {
    const bluetooth = this.bluetooth;
    if (!bluetooth || !isSecureContext) {
      return {
        api: false,
        adapterAvailable: false,
        blocked: false,
        watchAdvertisements: false,
        requestLEScan: false,
        getDevices: false,
      };
    }
    const [adapterAvailable, blocked] = await Promise.all([
      bluetooth.getAvailability().catch(() => false),
      bluetoothBlocked(),
    ]);
    return {
      api: true,
      adapterAvailable,
      blocked,
      watchAdvertisements: watchAdvertisementsAvailable(),
      requestLEScan: 'requestLEScan' in bluetooth && typeof bluetooth.requestLEScan === 'function',
      getDevices: 'getDevices' in bluetooth,
    };
  }

  async requestDevice(request: ScanRequest): Promise<ChosenDevice> {
    const bluetooth = this.bluetooth;
    if (!bluetooth) throw new ToolError('UNSUPPORTED', 'This browser has no Web Bluetooth.');
    // Called inside the person's tap: the chooser opens first, the availability check is only
    // used to tell a missing adapter from a cancel (scan-for-the-device design).
    const chooser = bluetooth.requestDevice(request.options);
    let device: BluetoothDevice;
    try {
      device = await chooser;
    } catch (error) {
      const name = errorName(error);
      const adapter = await bluetooth.getAvailability().catch(() => false);
      this.log.append({
        kind: 'scan',
        direction: 'out',
        hex: '',
        detail: `${request.mode}: ${name}`,
      });
      if (!adapter || name === 'SecurityError' || name === 'NotAllowedError') {
        throw new ToolError('BLE_UNAVAILABLE', 'Bluetooth is off or blocked for this site.');
      }
      if (name === 'NotFoundError') {
        throw new ToolError('USER_CANCELLED', 'The person closed the chooser without picking.');
      }
      throw new ToolError('UNSUPPORTED', `Chrome refused the scan (${name}).`);
    }
    this.devices.set(device.id, device);
    this.log.append({
      kind: 'scan',
      direction: 'in',
      hex: '',
      detail: `${request.mode}: chose ${device.id}`,
    });
    return { deviceId: device.id, name: device.name ?? null, advertisedServices: [] };
  }

  async connect(deviceId: string, timeoutMs: number): Promise<{ at: number; entryId: string }> {
    const device = this.devices.get(deviceId);
    if (!device?.gatt) throw new ToolError('PRECONDITION_FAILED', 'No device was chosen.');
    this.state.set({
      status: 'connecting',
      deviceId,
      deviceName: device.name ?? null,
      connectedAt: null,
    });
    let cancel = (): void => undefined;
    const timeout = new Promise<never>((_, reject) => {
      cancel = this.clock.setTimeout(
        () => reject(new ToolError('TIMEOUT', 'The device did not answer in time.')),
        timeoutMs,
      );
    });
    try {
      await Promise.race([device.gatt.connect(), timeout]);
    } catch (error) {
      this.state.set(DISCONNECTED);
      if (error instanceof ToolError) {
        device.gatt.disconnect();
        throw error;
      }
      this.log.append({ kind: 'connect', direction: 'out', hex: '', detail: errorName(error) });
      throw new ToolError(
        'CONNECTION_FAILED',
        `The device refused the connection (${errorName(error)}).`,
      );
    } finally {
      cancel();
    }
    device.addEventListener('gattserverdisconnected', this.onDisconnected);
    this.device = device;
    const entryId = this.log.append({
      kind: 'connect',
      direction: 'out',
      hex: '',
      detail: deviceId,
    });
    const at = this.clock.now();
    this.state.set({
      status: 'connected',
      deviceId,
      deviceName: device.name ?? null,
      connectedAt: at,
    });
    return { at, entryId };
  }

  async primaryServices(): Promise<GattServiceInfo[]> {
    const gatt = this.requireConnected();
    let services: BluetoothRemoteGATTService[];
    try {
      services = await gatt.getPrimaryServices();
    } catch (error) {
      if (errorName(error) === 'NotFoundError') return [];
      throw this.gattError(error);
    }
    const layout: GattServiceInfo[] = [];
    for (const service of services) {
      const uuid = canonicalUuid(service.uuid);
      this.services.set(uuid, service);
      try {
        const characteristics = await service.getCharacteristics();
        layout.push({
          uuid,
          characteristics: characteristics.map((c) => ({
            uuid: canonicalUuid(c.uuid),
            properties: PROPERTIES.filter((p) => c.properties[p]),
          })),
        });
      } catch (error) {
        layout.push({ uuid, characteristics: [], error: errorName(error) });
      }
    }
    return layout;
  }

  async read(service: string, characteristic: string): Promise<ReadResult> {
    this.requireConnected();
    const handle = this.services.get(canonicalUuid(service));
    if (!handle) throw new ToolError('SERVICE_NOT_PERMITTED', 'The browser hides that service.');
    try {
      const c = await handle.getCharacteristic(canonicalUuid(characteristic));
      const bytes = bytesOf(await c.readValue());
      const entryId = this.log.append({
        kind: 'read',
        direction: 'in',
        service: canonicalUuid(service),
        uuid: canonicalUuid(characteristic),
        hex: toHex(bytes),
      });
      return { bytes, entryId };
    } catch (error) {
      this.log.append({
        kind: 'read',
        direction: 'in',
        service: canonicalUuid(service),
        uuid: canonicalUuid(characteristic),
        hex: '',
        detail: errorName(error),
      });
      throw this.gattError(error);
    }
  }

  async subscribe(
    service: string,
    characteristic: string,
    receive: (value: ReadResult & { t: number }) => NotificationDecoding | undefined,
  ): Promise<() => Promise<void>> {
    this.requireConnected();
    const serviceUuid = canonicalUuid(service);
    const uuid = canonicalUuid(characteristic);
    const subscriptionKey = `${serviceUuid}/${uuid}`;
    const handle = this.services.get(serviceUuid);
    if (!handle) throw new ToolError('SERVICE_NOT_PERMITTED', 'The browser hides that service.');
    try {
      const c = await handle.getCharacteristic(uuid);
      if (!c.properties.notify && !c.properties.indicate) {
        throw new ToolError('PROPERTY_MISSING', 'This characteristic does not send updates.');
      }
      await this.subscriptions.get(subscriptionKey)?.();
      const listener = (): void => {
        if (!c.value) return;
        const bytes = bytesOf(c.value);
        this.log.append(
          {
            kind: c.properties.notify ? 'notification' : 'indication',
            direction: 'in',
            service: serviceUuid,
            uuid,
            hex: toHex(bytes),
          },
          ({ id, t }) => receive({ bytes, entryId: id, t }),
        );
      };
      const stop = async (): Promise<void> => {
        if (this.subscriptions.get(subscriptionKey) !== stop) return;
        this.subscriptions.delete(subscriptionKey);
        c.removeEventListener('characteristicvaluechanged', listener);
        if (this.device?.gatt?.connected) await c.stopNotifications().catch(() => undefined);
      };
      this.subscriptions.set(subscriptionKey, stop);
      c.addEventListener('characteristicvaluechanged', listener);
      try {
        await c.startNotifications();
      } catch (error) {
        await stop();
        throw error;
      }
      return stop;
    } catch (error) {
      throw this.gattError(error);
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    if (!device) return;
    this.state.update((s) => ({ ...s, status: 'releasing' }));
    await Promise.all([...this.subscriptions.values()].map((stop) => stop()));
    device.gatt?.disconnect();
    // Chrome fires `gattserverdisconnected`; the fake does too. Make sure the state settles.
    if (this.device === device) {
      device.removeEventListener('gattserverdisconnected', this.onDisconnected);
      this.log.append({ kind: 'disconnect', direction: 'out', hex: '', detail: device.id });
      this.device = null;
      this.services.clear();
      this.state.set(DISCONNECTED);
      this.disconnects.next({ deviceId: device.id, at: this.clock.now(), intentional: true });
    }
  }

  private requireConnected(): BluetoothRemoteGATTServer {
    const gatt = this.device?.gatt;
    if (!gatt?.connected) throw new ToolError('NOT_CONNECTED', 'The device is not connected.');
    return gatt;
  }

  private gattError(error: unknown): ToolError {
    if (error instanceof ToolError) return error;
    const name = errorName(error);
    const message = error instanceof Error ? error.message : String(error);
    switch (name) {
      case 'NotFoundError':
      case 'NotSupportedError':
        return new ToolError('PROPERTY_MISSING', message);
      case 'SecurityError':
        return /blocklist/i.test(message)
          ? new ToolError('BLOCKLISTED', message)
          : new ToolError('SERVICE_NOT_PERMITTED', message);
      case 'NotAllowedError':
        return new ToolError('AUTH_REQUIRED', message);
      case 'NetworkError':
        return new ToolError('NOT_CONNECTED', message);
      default:
        return new ToolError('GATT_ERROR', `${name}: ${message}`);
    }
  }
}

function watchAdvertisementsAvailable(): boolean {
  const device = (globalThis as { BluetoothDevice?: { prototype: object } }).BluetoothDevice;
  return !!device && 'watchAdvertisements' in device.prototype;
}

async function bluetoothBlocked(): Promise<boolean> {
  const page = document as Document & {
    featurePolicy?: { allowsFeature(name: string): boolean; features(): string[] };
  };
  const policy = page.featurePolicy;
  if (policy?.features().includes('bluetooth') && !policy.allowsFeature('bluetooth')) return true;
  try {
    return (
      (await navigator.permissions?.query({ name: 'bluetooth' as PermissionName }))?.state ===
      'denied'
    );
  } catch {
    return false;
  }
}

function errorName(error: unknown): string {
  return error instanceof DOMException || error instanceof Error ? error.name : 'Error';
}
