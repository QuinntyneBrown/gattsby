import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeBluetoothApi } from '../../simulation/fake-bluetooth-api';
import { FTMS_TREADMILL } from '../../simulation/devices/ftms-treadmill.device';
import { canonicalUuid } from '../knowledge-base/uuid';
import { InvestigationStore } from '../store/investigation-store';
import { BLUETOOTH } from './bluetooth.token';
import { WebBluetoothBleLayer } from './web-bluetooth-ble-layer';

describe('Restoring Bluetooth notifications (TOOL-007)', () => {
  afterEach(() => vi.useRealTimers());

  it('rebinds both earlier subscriptions and receives packets after the reconnect', async () => {
    vi.useFakeTimers();
    const bluetooth = new FakeBluetoothApi(
      [FTMS_TREADMILL],
      { devices: [FTMS_TREADMILL.id], chooser: [{ pick: FTMS_TREADMILL.id }] },
      () => undefined,
    );
    TestBed.configureTestingModule({
      providers: [
        WebBluetoothBleLayer,
        { provide: BLUETOOTH, useValue: bluetooth },
        { provide: InvestigationStore, useValue: {} },
      ],
    });
    const ble = TestBed.inject(WebBluetoothBleLayer);
    const device = await ble.requestDevice({
      options: { filters: [{ services: [0x1826] }], optionalServices: [0x180d] },
      excludedAsBlocklisted: [],
      mode: 'filtered',
    });
    await ble.connect(device.deviceId, 10_000);
    await ble.primaryServices();
    const treadmill = canonicalUuid(0x2acd);
    const pulse = canonicalUuid(0x2a37);
    const onSpeed = vi.fn();
    const onPulse = vi.fn();
    try {
      await ble.subscribe(canonicalUuid(0x1826), treadmill, onSpeed);
      await ble.subscribe(canonicalUuid(0x180d), pulse, onPulse);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(onSpeed).toHaveBeenCalledOnce();
      expect(onPulse).toHaveBeenCalledOnce();
      bluetooth.dropConnection(0);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(onSpeed).toHaveBeenCalledOnce();
      expect(onPulse).toHaveBeenCalledOnce();
      await ble.connect(device.deviceId, 10_000);
      expect(await ble.restoreSubscriptions(device.deviceId, new AbortController().signal)).toEqual(
        [treadmill, pulse],
      );
      await vi.advanceTimersByTimeAsync(1_000);
      expect(onSpeed).toHaveBeenCalledTimes(2);
      expect(onPulse).toHaveBeenCalledTimes(2);
    } finally {
      await ble.disconnect();
    }
  });
});
