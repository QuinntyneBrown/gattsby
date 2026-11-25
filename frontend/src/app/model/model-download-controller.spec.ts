import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { Clock } from '../shared/clock';
import { ModelDownloadController } from './model-download-controller';
import { PromptApiModelAdapter } from './prompt-api-model-adapter';

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
      { provide: PromptApiModelAdapter, useValue: { download } },
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
