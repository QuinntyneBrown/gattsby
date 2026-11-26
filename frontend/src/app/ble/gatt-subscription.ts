import type { NotificationDecoding } from '../store/model/notification-decoding';
import type { ReadResult } from './ble-layer';

export interface GattSubscription {
  readonly service: string;
  readonly characteristic: string;
  receive(value: ReadResult & { t: number }): NotificationDecoding | undefined;
  stop(): Promise<void>;
}
