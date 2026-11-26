import type { Page } from '@playwright/test';

export async function usePlateCamera(
  page: Page,
): Promise<() => Promise<{ opened: number; stopped: number }>> {
  await page.addInitScript(() => {
    const camera = { opened: 0, stopped: 0 };
    Object.defineProperty(window, '__plateCamera', { value: camera });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        camera.opened++;
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        const draw = () => {
          ctx.fillStyle = '#e9e4d8';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#202021';
          ctx.font = '22px sans-serif';
          ctx.fillText('Fixture Fitness', 24, 80);
          ctx.fillText('Model T100', 24, 117);
        };
        draw();
        const stream = canvas.captureStream(10);
        const track = stream.getVideoTracks()[0];
        const refresh = setInterval(draw, 100);
        const stop = track.stop.bind(track);
        track.stop = () => {
          if (track.readyState !== 'ended') camera.stopped++;
          clearInterval(refresh);
          stop();
        };
        return stream;
      },
    });
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { __plateCamera: { opened: number; stopped: number } }).__plateCamera,
    );
}
