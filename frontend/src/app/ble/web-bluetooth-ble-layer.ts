import { inject, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { GattProperty } from '../knowledge-base/knowledge-base-data';
import type { NotificationDecoding } from '../store/model/notification-decoding';
import type { AdvertisementSample } from '../store/model/advertisement-sample';
import { canonicalUuid } from '../knowledge-base/uuid';
import { FTMS_CONTROL_POINT, FTMS_SERVICE } from '../knowledge-base/ftms-control-point';
import { Clock } from '../shared/clock';
import { ToolError } from '../tools/tool-error';
import type { BleAvailability } from './ble-availability';
import { ApprovalLedger } from './approval-ledger';
import { BleLayer, type ReadResult } from './ble-layer';
import { BLUETOOTH } from './bluetooth.token';
import type { BluetoothAdvertisingEvent } from './bluetooth-advertising-event';
import type { ChosenDevice } from './chosen-device';
import type { ConnectionState, DisconnectEvent } from './connection-state';
import type { GattServiceInfo } from './gatt-layout';
import type { GattSubscription } from './gatt-subscription';
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

type WatchableDevice = BluetoothDevice & {
  watchAdvertisements?(options: { signal: AbortSignal }): Promise<void>;
};

type AdvertisementScanner = Bluetooth & {
  requestLEScan?(options: {
    acceptAllAdvertisements: boolean;
    keepRepeatedDevices: boolean;
  }): Promise<{ stop(): void }>;
};

const MAX_ADVERTISING_FIELDS = 8;
const MAX_ADVERTISING_BYTES = 64;
const NOTIFICATION_STOP_TIMEOUT_MS = 1_000;

// The BLE layer on Web Bluetooth (scan-for-the-device, connect-to-the-device,
// enumerate-the-gatt-layout and release-the-connection designs).
@Injectable()
export class WebBluetoothBleLayer extends BleLayer {
  private readonly bluetooth = inject(BLUETOOTH);
  private readonly clock = inject(Clock);
  private readonly log = inject(RawTrafficLog);
  private readonly approvals = inject(ApprovalLedger);
  private readonly devices = new Map<string, BluetoothDevice>();
  private readonly services = new Map<string, BluetoothRemoteGATTService>();
  private readonly subscriptions = new Map<string, GattSubscription>();
  private droppedSubscriptions: { deviceId: string; entries: GattSubscription[] } | null = null;
  private device: BluetoothDevice | null = null;
  private readonly state = signal<ConnectionState>(DISCONNECTED);
  private readonly disconnects = new Subject<DisconnectEvent>();
  readonly connection = this.state.asReadonly();
  readonly disconnected = this.disconnects.asObservable();

  private readonly onDisconnected = (event: Event): void => {
    const device = event.target as BluetoothDevice;
    const intentional = this.state().status === 'releasing';
    this.log.append({ kind: 'disconnect', direction: 'in', hex: '', detail: device.id });
    if (!intentional) this.rememberSubscriptions(device.id);
    for (const subscription of this.subscriptions.values()) void subscription.stop();
    device.removeEventListener('gattserverdisconnected', this.onDisconnected);
    this.services.clear();
    if (this.device === device) {
      this.device = null;
      this.state.set(DISCONNECTED);
    }
    this.disconnects.next({ deviceId: device.id, at: this.clock.now(), intentional });
  };

  private rememberSubscriptions(deviceId: string): void {
    const entries = [...this.subscriptions.values()].filter(
      ({ characteristic }) => characteristic !== FTMS_CONTROL_POINT,
    );
    if (entries.length || this.droppedSubscriptions?.deviceId !== deviceId)
      this.droppedSubscriptions = { deviceId, entries };
  }

  async suspendSubscriptions(): Promise<void> {
    if (!this.device) return;
    this.rememberSubscriptions(this.device.id);
    await this.stopSubscriptions();
  }

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
      bluetooth.getAvailability(),
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

  async permittedDevices(): Promise<ChosenDevice[]> {
    const permitted = await this.bluetooth?.getDevices?.();
    if (permitted) {
      for (const device of permitted) this.devices.set(device.id, device);
    }
    return [...this.devices.values()].map((device) => ({
      deviceId: device.id,
      name: device.name || null,
      advertisedServices: [],
    }));
  }

  async watchAdvertisements(
    deviceIds: readonly string[],
    receive: (sample: AdvertisementSample) => void,
    signal: AbortSignal,
  ): Promise<void> {
    signal.throwIfAborted();
    const bluetooth = this.bluetooth as AdvertisementScanner | undefined;
    const targets = new Set(deviceIds);
    const devices = [...targets].map((id) => this.devices.get(id) as WatchableDevice | undefined);
    if (!devices.length || devices.some((device) => !device)) {
      throw new ToolError(
        'PRECONDITION_FAILED',
        'Choose the candidates in Chrome before watching them.',
      );
    }
    const listener = (event: Event) => {
      const packet = event as BluetoothAdvertisingEvent;
      if (!targets.has(packet.device.id)) return;
      const manufacturerData = advertisementFields(
        packet.manufacturerData,
        (id) => `0x${id.toString(16).toUpperCase().padStart(4, '0')}`,
      );
      const serviceData = advertisementFields(packet.serviceData, canonicalUuid);
      const values = {
        deviceId: packet.device.id,
        rssi: packet.rssi ?? null,
        ...(packet.txPower == null ? {} : { txPower: packet.txPower }),
        serviceUuids: (packet.uuids ?? []).slice(0, 32).map(canonicalUuid),
        manufacturerData,
        serviceData,
      };
      const evidenceId = this.log.append({
        kind: 'advertisement',
        direction: 'in',
        hex: '',
        detail: JSON.stringify(values),
      });
      receive({ ...values, t: this.clock.now(), evidenceId });
    };
    try {
      if (
        watchAdvertisementsAvailable() &&
        devices.every((device) => !!device?.watchAdvertisements)
      ) {
        await Promise.all(
          devices.map((device) => {
            device!.addEventListener('advertisementreceived', listener, { signal });
            return device!.watchAdvertisements!({ signal });
          }),
        );
      } else if (bluetooth?.requestLEScan) {
        bluetooth.addEventListener('advertisementreceived', listener, { signal });
        const scan = await bluetooth.requestLEScan({
          acceptAllAdvertisements: true,
          keepRepeatedDevices: true,
        });
        if (signal.aborted) scan.stop();
        else signal.addEventListener('abort', () => scan.stop(), { once: true });
      } else {
        throw new ToolError('UNSUPPORTED', 'This browser cannot watch Bluetooth advertisements.');
      }
    } catch (error) {
      throw this.gattError(error);
    }
  }

  async connect(deviceId: string, timeoutMs: number, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const device = this.devices.get(deviceId);
    if (!device?.gatt) throw new ToolError('PRECONDITION_FAILED', 'No device was chosen.');
    this.state.set({
      status: 'connecting',
      deviceId,
      deviceName: device.name ?? null,
      connectedAt: null,
    });
    let cancel = (): void => undefined;
    let abort = (): void => undefined;
    let abandoned = false;
    const timeout = new Promise<never>((_, reject) => {
      cancel = this.clock.setTimeout(
        () => reject(new ToolError('TIMEOUT', 'The device did not answer in time.')),
        timeoutMs,
      );
      abort = () => reject(new ToolError('ABORTED', 'The connection attempt was stopped.'));
      signal?.addEventListener('abort', abort, { once: true });
    });
    try {
      const attempt = device.gatt.connect().then((server) => {
        if (abandoned && this.device !== device) server.disconnect();
      });
      await Promise.race([attempt, timeout]);
    } catch (error) {
      abandoned = true;
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
      signal?.removeEventListener('abort', abort);
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

  async restoreSubscriptions(deviceId: string, signal: AbortSignal): Promise<string[]> {
    const gatt = this.requireConnected();
    if (this.device?.id !== deviceId)
      throw new ToolError('PRECONDITION_FAILED', 'This connection belongs to another device.');
    const snapshot = this.droppedSubscriptions;
    const restored: string[] = [];
    try {
      const services = await gatt.getPrimaryServices().catch((error) => {
        if (errorName(error) === 'NotFoundError') return [];
        throw this.gattError(error);
      });
      signal.throwIfAborted();
      for (const service of services) this.services.set(canonicalUuid(service.uuid), service);
      if (snapshot?.deviceId === deviceId) {
        for (const { service, characteristic, receive } of snapshot.entries) {
          await this.subscribe(service, characteristic, receive);
          signal.throwIfAborted();
          restored.push(characteristic);
        }
      }
    } catch (error) {
      await this.releaseConnection();
      if (!signal.aborted) this.droppedSubscriptions = snapshot;
      throw error;
    }
    this.droppedSubscriptions = null;
    return restored;
  }

  async primaryServices(): Promise<GattServiceInfo[]> {
    const gatt = this.requireConnected();
    const connection = this.state();
    let services: BluetoothRemoteGATTService[];
    try {
      services = await gatt.getPrimaryServices();
    } catch (error) {
      this.requireSameConnection(connection);
      if (errorName(error) === 'NotFoundError') return [];
      throw this.gattError(error);
    }
    this.requireSameConnection(connection);
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
      this.requireSameConnection(connection);
    }
    return layout;
  }

  async read(service: string, characteristic: string): Promise<ReadResult> {
    this.requireConnected();
    const connection = this.state();
    const handle = this.services.get(canonicalUuid(service));
    if (!handle) throw new ToolError('SERVICE_NOT_PERMITTED', 'The browser hides that service.');
    try {
      const c = await handle.getCharacteristic(canonicalUuid(characteristic));
      this.requireSameConnection(connection);
      const bytes = bytesOf(await c.readValue());
      this.requireSameConnection(connection);
      const entryId = this.log.append({
        kind: 'read',
        direction: 'in',
        service: canonicalUuid(service),
        uuid: canonicalUuid(characteristic),
        hex: toHex(bytes),
      });
      return { bytes, entryId };
    } catch (error) {
      this.requireSameConnection(connection);
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
    const connection = this.state();
    const serviceUuid = canonicalUuid(service);
    const uuid = canonicalUuid(characteristic);
    const subscriptionKey = `${serviceUuid}/${uuid}`;
    const handle = this.services.get(serviceUuid);
    if (!handle) throw new ToolError('SERVICE_NOT_PERMITTED', 'The browser hides that service.');
    try {
      const c = await handle.getCharacteristic(uuid);
      this.requireSameConnection(connection);
      if (!c.properties.notify && !c.properties.indicate) {
        throw new ToolError('PROPERTY_MISSING', 'This characteristic does not send updates.');
      }
      await this.subscriptions.get(subscriptionKey)?.stop();
      this.requireSameConnection(connection);
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
        if (this.subscriptions.get(subscriptionKey)?.stop !== stop) return;
        this.subscriptions.delete(subscriptionKey);
        c.removeEventListener('characteristicvaluechanged', listener);
        if (this.device?.gatt?.connected) await c.stopNotifications().catch(() => undefined);
      };
      this.subscriptions.set(subscriptionKey, {
        service: serviceUuid,
        characteristic: uuid,
        receive,
        stop,
      });
      c.addEventListener('characteristicvaluechanged', listener);
      try {
        await c.startNotifications();
        this.requireSameConnection(connection);
      } catch (error) {
        await stop();
        throw error;
      }
      return stop;
    } catch (error) {
      throw this.gattError(error);
    }
  }

  async write(
    service: string,
    characteristic: string,
    bytes: Uint8Array,
    approvalId: string,
  ): Promise<string> {
    this.requireConnected();
    const serviceUuid = canonicalUuid(service);
    const uuid = canonicalUuid(characteristic);
    if (serviceUuid !== FTMS_SERVICE || uuid !== FTMS_CONTROL_POINT) {
      throw new ToolError(
        'PRECONDITION_FAILED',
        'This characteristic is not a known write target.',
      );
    }
    const handle = this.services.get(serviceUuid);
    const deviceId = this.device!.id;
    const connectedAt = this.state().connectedAt!;
    if (!handle) throw new ToolError('SERVICE_NOT_PERMITTED', 'The browser hides that service.');
    try {
      const target = await handle.getCharacteristic(uuid);
      if (!target.properties.write)
        throw new ToolError('PROPERTY_MISSING', 'This characteristic is not writable.');
      this.requireConnected();
      if (this.device?.id !== deviceId || this.state().connectedAt !== connectedAt)
        throw new ToolError('NOT_CONNECTED', 'The connection changed.');
      const payload = new Uint8Array(bytes);
      this.approvals.consume(approvalId, deviceId, connectedAt, serviceUuid, uuid, payload);
      const entryId = this.log.append({
        kind: 'write',
        direction: 'out',
        service: serviceUuid,
        uuid,
        hex: toHex(payload),
        approvalId,
      });
      await target.writeValueWithResponse(payload);
      return entryId;
    } catch (error) {
      throw this.gattError(error);
    }
  }

  async disconnect(): Promise<void> {
    this.droppedSubscriptions = null;
    await this.releaseConnection();
  }

  private async releaseConnection(): Promise<void> {
    const device = this.device;
    if (!device) return;
    this.state.update((s) => ({ ...s, status: 'releasing' }));
    await this.stopSubscriptions();
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

  private async stopSubscriptions(): Promise<void> {
    const stops = [...this.subscriptions.values()].map(({ stop }) => stop());
    if (stops.length) {
      let cancel = (): void => undefined;
      try {
        await Promise.race([
          Promise.allSettled(stops),
          new Promise<void>((resolve) => {
            cancel = this.clock.setTimeout(resolve, NOTIFICATION_STOP_TIMEOUT_MS);
          }),
        ]);
      } finally {
        cancel();
      }
    }
  }

  private requireConnected(): BluetoothRemoteGATTServer {
    const gatt = this.device?.gatt;
    if (!gatt?.connected || this.state().status !== 'connected')
      throw new ToolError('NOT_CONNECTED', 'The device is not connected.');
    return gatt;
  }

  private requireSameConnection(connection: ConnectionState): void {
    if (connection !== this.state())
      throw new ToolError('NOT_CONNECTED', 'The Bluetooth connection changed.');
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

function advertisementFields<K>(
  fields: ReadonlyMap<K, DataView> | undefined,
  key: (value: K) => string,
) {
  return Object.fromEntries(
    [...(fields ?? [])]
      .slice(0, MAX_ADVERTISING_FIELDS)
      .map(([id, view]) => [key(id), toHex(bytesOf(view).slice(0, MAX_ADVERTISING_BYTES))]),
  );
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
