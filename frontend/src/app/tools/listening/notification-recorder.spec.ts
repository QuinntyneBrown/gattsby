import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { FakeBluetoothApi } from '../../../simulation/fake-bluetooth-api';
import { ConfirmationCheck } from '../../agent/confirmation-check';
import { PromptChannel } from '../../agent/prompt-channel';
import { BLUETOOTH } from '../../ble/bluetooth.token';
import { RawTrafficLog, WINDOW } from '../../ble/raw-traffic-log';
import { WebBluetoothBleLayer } from '../../ble/web-bluetooth-ble-layer';
import { treadmillDataDecoder } from '../../knowledge-base/decoders/treadmill-data.decoder';
import { canonicalUuid } from '../../knowledge-base/uuid';
import { LiveMetrics } from '../../live/live-metrics';
import { InvestigationStore } from '../../store/investigation-store';
import type { RawLogEntry } from '../../store/model/raw-log-entry';
import { NotificationRecorder } from './notification-recorder';

const SERVICE = 0x1826;
const STREAMS = [0x2acd, 0xfff1, 0xfff2, 0xfff3];

async function connect() {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  const packets: RawLogEntry[] = [];
  const fake = new FakeBluetoothApi(
    [
      {
        id: 'streaming-machine',
        name: 'Streaming machine',
        advertisedServices: [SERVICE],
        services: [
          {
            uuid: SERVICE,
            characteristics: STREAMS.map((uuid) => ({
              uuid,
              properties: { notify: true },
              notificationIntervalMs: 20,
              notify: () => [0, 0, 44, 1],
            })),
          },
        ],
      },
    ],
    { devices: ['streaming-machine'], chooser: [{ pick: 'streaming-machine' }] },
    (event) => expect(event.kind).not.toBe('unexpected-bluetooth'),
  );
  TestBed.configureTestingModule({
    providers: [
      WebBluetoothBleLayer,
      NotificationRecorder,
      ConfirmationCheck,
      PromptChannel,
      LiveMetrics,
      { provide: BLUETOOTH, useValue: fake },
      {
        provide: InvestigationStore,
        useValue: {
          flushRawLog: async (batch: readonly RawLogEntry[]) => void packets.push(...batch),
        },
      },
    ],
  });
  const log = TestBed.inject(RawTrafficLog);
  const ble = TestBed.inject(WebBluetoothBleLayer);
  log.begin('test', 0);
  const device = await ble.requestDevice({
    mode: 'filtered',
    options: { filters: [{ services: [SERVICE] }] },
    excludedAsBlocklisted: [],
  });
  await ble.connect(device.deviceId, 1000);
  await ble.primaryServices();
  return { ble, log, packets, recorder: TestBed.inject(NotificationRecorder) };
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

it('logs all 12,000 decoded notifications in order at 50 Hz on four characteristics (NFR-003, NFR-005)', async () => {
  const { ble, log, recorder, packets } = await connect();
  const result = recorder.record(
    ble,
    STREAMS.map((uuid) => ({
      uuid: canonicalUuid(uuid),
      service: canonicalUuid(SERVICE),
      decoder: treadmillDataDecoder,
    })),
    'rec-1',
    60,
    new AbortController().signal,
  );
  await vi.advanceTimersByTimeAsync(60_001);
  expect((await result).perCharacteristic.map(({ count }) => count)).toEqual([
    3000, 3000, 3000, 3000,
  ]);
  const recorded = [...packets, ...log.takePending()].filter(
    ({ recordingId }) => recordingId === 'rec-1',
  );
  expect(recorded).toHaveLength(12_000);
  expect(
    recorded.every(
      (entry, index) =>
        entry.decoded?.[0]?.value === 3 &&
        (index === 0 ||
          (entry.seq === recorded[index - 1].seq + 1 && entry.t >= recorded[index - 1].t)),
    ),
  ).toBe(true);
  expect(log.latest(12_000)).toHaveLength(WINDOW);
  expect(TestBed.inject(LiveMetrics).metrics()[0]?.value).toBe(3);
  await ble.disconnect();
  log.clear();
  expect(log.latest(WINDOW)).toEqual([]);
});

it('logs each notification once when a new recording uses the same characteristic', async () => {
  const { ble, log, recorder, packets } = await connect();
  const source = {
    uuid: canonicalUuid(STREAMS[0]),
    service: canonicalUuid(SERVICE),
    decoder: treadmillDataDecoder,
  };
  for (const id of ['rec-1', 'rec-2']) {
    const result = recorder.record(ble, [source], id, 1, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1001);
    expect((await result).count).toBe(50);
  }
  expect(
    [...packets, ...log.takePending()].filter(({ kind }) => kind === 'notification'),
  ).toHaveLength(100);
  await ble.disconnect();
});
