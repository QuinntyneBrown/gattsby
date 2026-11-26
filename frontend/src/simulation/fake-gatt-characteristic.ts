import { canonicalUuid } from './bluetooth-uuid';
import { notScripted } from './not-scripted';
import type { ScriptedCharacteristic } from './scripted-characteristic';
import type { Report } from './simulation-event';
import type { SimulationState } from './simulation-state';

const NOTIFY_INTERVAL_MS = 1000;

export interface CharacteristicContext {
  readonly report: Report;
  readonly state: SimulationState;
  readonly deviceName: string;
  readonly serviceUuid: string;
  readonly isConnected: () => boolean;
  readonly onDisconnect: (stop: () => void) => void;
  readonly readDelays: Readonly<Record<string, number>>;
}

// The parts of BluetoothRemoteGATTCharacteristic the BLE layer uses.
export class FakeGattCharacteristic extends EventTarget {
  readonly uuid: string;
  readonly properties: Readonly<Record<string, boolean>>;
  value: DataView | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly service: unknown,
    private readonly script: ScriptedCharacteristic,
    private readonly context: CharacteristicContext,
  ) {
    super();
    this.uuid = canonicalUuid(script.uuid);
    const p = script.properties;
    this.properties = {
      broadcast: false,
      read: !!p.read,
      writeWithoutResponse: !!p.writeWithoutResponse,
      write: !!p.write,
      notify: !!p.notify,
      indicate: !!p.indicate,
      authenticatedSignedWrites: false,
      reliableWrite: false,
      writableAuxiliaries: false,
    };
    context.onDisconnect(() => this.stop());
  }

  async readValue(): Promise<DataView> {
    this.call('readValue');
    this.requireConnection();
    if (!this.script.properties.read || !this.script.read) {
      throw new DOMException('GATT operation not permitted.', 'NotSupportedError');
    }
    const delay = this.context.readDelays[this.uuid];
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      // Chrome rejects a read still pending when the connection closes.
      this.requireConnection();
    }
    this.value = toDataView(this.script.read(this.context.state));
    return this.value;
  }

  writeValue(value: BufferSource): Promise<void> {
    return this.write(value, true);
  }

  writeValueWithResponse(value: BufferSource): Promise<void> {
    return this.write(value, true);
  }

  writeValueWithoutResponse(value: BufferSource): Promise<void> {
    return this.write(value, false);
  }

  async startNotifications(): Promise<this> {
    this.call('startNotifications');
    this.requireConnection();
    if (!this.script.properties.notify && !this.script.properties.indicate) {
      throw new DOMException('GATT operation not permitted.', 'NotSupportedError');
    }
    const notify = this.script.notify;
    if (notify && this.timer === null) {
      this.timer = setInterval(() => {
        this.context.state.ticks += 1;
        const bytes = notify(this.context.state);
        if (bytes) this.emit(bytes);
      }, this.script.notificationIntervalMs ?? NOTIFY_INTERVAL_MS);
    }
    return this;
  }

  async stopNotifications(): Promise<this> {
    this.call('stopNotifications');
    this.stop();
    return this;
  }

  getDescriptor(): Promise<never> {
    return this.unexpected('getDescriptor');
  }

  getDescriptors(): Promise<never> {
    return this.unexpected('getDescriptors');
  }

  private async write(value: BufferSource, withResponse: boolean): Promise<void> {
    const bytes = [...toBytes(value)];
    this.call(withResponse ? 'writeValueWithResponse' : 'writeValueWithoutResponse');
    this.requireConnection();
    this.context.report({
      kind: 'write',
      device: this.context.deviceName,
      service: this.context.serviceUuid,
      characteristic: this.uuid,
      bytes,
      withResponse,
    });
    const writable = withResponse
      ? this.script.properties.write
      : this.script.properties.writeWithoutResponse;
    if (!writable || !this.script.onWrite) {
      throw new DOMException('GATT operation not permitted.', 'NotSupportedError');
    }
    const response = this.script.onWrite(bytes, this.context.state);
    if (response.error) {
      throw new DOMException('GATT operation failed.', response.error);
    }
    const reply = response.reply;
    if (reply) {
      queueMicrotask(() => this.emit(reply));
    }
  }

  private emit(bytes: readonly number[]): void {
    this.value = toDataView(bytes);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private requireConnection(): void {
    if (!this.context.isConnected()) {
      throw new DOMException('GATT Server is disconnected.', 'NetworkError');
    }
  }

  private call(method: string): void {
    this.context.report({ kind: 'bluetooth-call', method, detail: this.uuid });
  }

  private async unexpected(method: string): Promise<never> {
    const detail = `${method} on ${this.uuid}`;
    this.context.report({ kind: 'unexpected-bluetooth', detail });
    throw notScripted(detail);
  }
}

function toBytes(value: BufferSource): Uint8Array {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function toDataView(bytes: readonly number[]): DataView {
  return new DataView(Uint8Array.from(bytes).buffer);
}
