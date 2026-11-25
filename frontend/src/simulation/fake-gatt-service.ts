import { canonicalUuid } from './bluetooth-uuid';
import { FakeGattCharacteristic, type CharacteristicContext } from './fake-gatt-characteristic';
import type { ScriptedService } from './scripted-service';
import type { Report } from './simulation-event';

// The parts of BluetoothRemoteGATTService the BLE layer uses.
export class FakeGattService {
  readonly uuid: string;
  readonly isPrimary = true;
  private readonly characteristics: FakeGattCharacteristic[];

  constructor(
    readonly device: unknown,
    script: ScriptedService,
    context: Omit<CharacteristicContext, 'serviceUuid'>,
    private readonly report: Report,
  ) {
    this.uuid = canonicalUuid(script.uuid);
    this.characteristics = script.characteristics.map(
      (characteristic) =>
        new FakeGattCharacteristic(this, characteristic, { ...context, serviceUuid: this.uuid }),
    );
  }

  async getCharacteristic(uuid: number | string): Promise<FakeGattCharacteristic> {
    const wanted = canonicalUuid(uuid);
    this.report({ kind: 'bluetooth-call', method: 'getCharacteristic', detail: wanted });
    const found = this.characteristics.find((characteristic) => characteristic.uuid === wanted);
    if (!found) {
      throw new DOMException(
        `No Characteristics matching UUID ${wanted} found in Service.`,
        'NotFoundError',
      );
    }
    return found;
  }

  async getCharacteristics(uuid?: number | string): Promise<FakeGattCharacteristic[]> {
    const wanted = uuid === undefined ? undefined : canonicalUuid(uuid);
    this.report({ kind: 'bluetooth-call', method: 'getCharacteristics', detail: wanted ?? '*' });
    const found = this.characteristics.filter((c) => wanted === undefined || c.uuid === wanted);
    if (found.length === 0) {
      throw new DOMException('No Characteristics found in service.', 'NotFoundError');
    }
    return found;
  }

  async getIncludedService(): Promise<never> {
    return this.unexpected('getIncludedService');
  }

  async getIncludedServices(): Promise<never> {
    return this.unexpected('getIncludedServices');
  }

  private unexpected(method: string): never {
    const detail = `${method} on ${this.uuid}`;
    this.report({ kind: 'unexpected-bluetooth', detail });
    throw new DOMException(`Not scripted: ${detail}`, 'NotSupportedError');
  }
}
