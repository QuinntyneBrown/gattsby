import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { Clock } from '../shared/clock';
import { ModelDownloadController } from './model-download-controller';
import { ModelAdapterLoader } from './model-adapter-loader';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

it('updates download status every second while preserving measured progress', async () => {
  vi.useFakeTimers();
  let reportProgress: (percent: number) => void = () => undefined;
  let complete: () => void = () => undefined;
  const download = vi.fn(
    (progress: (percent: number) => void) =>
      new Promise<void>((resolve) => {
        reportProgress = progress;
        complete = resolve;
      }),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: ModelAdapterLoader, useValue: { load: async () => ({ download }) } },
      {
        provide: Clock,
        useValue: {
          now: () => Date.now(),
          setTimeout: (callback: () => void, delay: number) => {
            const timer = setTimeout(callback, delay);
            return () => clearTimeout(timer);
          },
        },
      },
    ],
  });
  const controller = TestBed.inject(ModelDownloadController);
  await controller.prepare();
  expect(download).not.toHaveBeenCalled();
  const work = controller.start();
  await vi.advanceTimersByTimeAsync(1000);
  expect(controller.elapsed()).toBe(1);
  expect(controller.progress()).toBe(0);
  reportProgress(43);
  await vi.advanceTimersByTimeAsync(1000);
  expect(controller.elapsed()).toBe(2);
  expect(controller.progress()).toBe(43);
  complete();
  await work;
  expect(controller.status()).toBe('available');
  expect(controller.progress()).toBe(100);
  expect(vi.getTimerCount()).toBe(0);
});

it('aborts the active transfer and ignores a completion from the canceled attempt', async () => {
  let canceledSignal: AbortSignal | undefined;
  let finishCanceled: () => void = () => undefined;
  let lateProgress: (percent: number) => void = () => undefined;
  const download = vi
    .fn<(progress: (percent: number) => void, signal: AbortSignal) => Promise<void>>()
    .mockImplementationOnce((progress, signal) => {
      canceledSignal = signal;
      lateProgress = progress;
      return new Promise((resolve) => (finishCanceled = resolve));
    })
    .mockResolvedValueOnce(undefined);
  TestBed.configureTestingModule({
    providers: [{ provide: ModelAdapterLoader, useValue: { load: async () => ({ download }) } }],
  });
  const controller = TestBed.inject(ModelDownloadController);
  await controller.prepare();
  const canceled = controller.start();
  controller.cancel();
  expect(canceledSignal?.aborted).toBe(true);
  expect(controller.status()).toBe('idle');
  lateProgress(50);
  finishCanceled();
  await canceled;
  expect(controller.status()).toBe('idle');
  expect(controller.progress()).toBe(0);
  await controller.start();
  expect(controller.status()).toBe('available');
});
