import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { BleAvailability } from './ble-availability';
import type { ChosenDevice } from './chosen-device';
import type { ConnectionState, DisconnectEvent } from './connection-state';
import type { GattServiceInfo } from './gatt-layout';
import type { ScanRequest } from './scan-request';
import type { NotificationDecoding } from '../store/model/notification-decoding';
import type { AdvertisementSample } from '../store/model/advertisement-sample';

export interface ReadResult {
  readonly bytes: Uint8Array;
  /** The raw log entry's evidence ID. */
  readonly entryId: string;
}

// The contract of the BLE layer, the only code that touches `navigator.bluetooth` (NFR-021). It
// maps every Web Bluetooth exception to a shared error code by throwing a `ToolError`, and logs
// every operation in the raw traffic log (FR-073).
export abstract class BleLayer {
  abstract readonly connection: Signal<ConnectionState>;
  abstract readonly disconnected: Observable<DisconnectEvent>;
  abstract availability(): Promise<BleAvailability>;
  /** Opens Chrome's chooser; must run inside the person's tap. */
  abstract requestDevice(request: ScanRequest): Promise<ChosenDevice>;
  abstract permittedDevices(): Promise<ChosenDevice[]>;
  abstract watchAdvertisements(
    deviceIds: readonly string[],
    receive: (sample: AdvertisementSample) => void,
    signal: AbortSignal,
  ): Promise<void>;
  abstract connect(deviceId: string, timeoutMs: number): Promise<{ at: number; entryId: string }>;
  abstract primaryServices(): Promise<GattServiceInfo[]>;
  abstract read(service: string, characteristic: string): Promise<ReadResult>;
  abstract write(
    service: string,
    characteristic: string,
    bytes: Uint8Array,
    approvalId: string,
  ): Promise<string>;
  abstract subscribe(
    service: string,
    characteristic: string,
    receive: (value: ReadResult & { t: number }) => NotificationDecoding | undefined,
  ): Promise<() => Promise<void>>;
  /** Stops every notification and disconnects; idempotent (TOOL-008). */
  abstract disconnect(): Promise<void>;
}
