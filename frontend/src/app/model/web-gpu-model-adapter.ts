import { Injectable } from '@angular/core';
import type { ModelAdapter } from './model-adapter';
import type { ModelAvailability } from './model-availability';
import type { ModelSession } from './model-session';
import type { PhoneModelFile } from './phone-model-file';
import { readPhoneModelManifest } from './phone-model-manifest';
import { WebGpuModelSession } from './web-gpu-model-session';

const MANIFEST = '/phone-model/manifest.json';
const UNAVAILABLE: ModelAvailability = {
  availability: 'unavailable',
  api: false,
  imageInput: false,
  source: 'phone',
};

@Injectable({ providedIn: 'root' })
export class WebGpuModelAdapter implements ModelAdapter {
  private manifestRequest?: ReturnType<typeof fetchManifest>;

  async availability(): Promise<ModelAvailability> {
    if (!(await hasWebGpu())) return { ...UNAVAILABLE, reason: 'webgpu' };
    if (typeof caches === 'undefined' || typeof Worker === 'undefined') return UNAVAILABLE;
    const manifest = await this.manifest();
    if (!manifest) return UNAVAILABLE;
    const files = await this.missingFiles(manifest.id, manifest.files);
    return {
      ...UNAVAILABLE,
      api: true,
      availability: files.length ? 'downloadable' : 'available',
    };
  }

  async downloadInfo(): Promise<number | null> {
    const manifest = await this.manifest();
    return manifest?.totalBytes ?? null;
  }

  async download(progress: (percent: number) => void, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const manifest = await this.manifest();
    if (!manifest) throw new DOMException('The phone model is unavailable.', 'NotSupportedError');
    const pending = await this.missingFiles(manifest.id, manifest.files);
    const remaining = pending.reduce((bytes, file) => bytes + file.bytes, 0);
    const { quota, usage } = await navigator.storage.estimate();
    if (quota !== undefined && usage !== undefined && quota - usage < remaining) {
      throw new DOMException(
        'There is not enough space for the phone model.',
        'QuotaExceededError',
      );
    }
    signal.throwIfAborted();
    const cache = await caches.open(cacheName(manifest.id));
    let completed = manifest.totalBytes - remaining;
    for (const file of pending) {
      signal.throwIfAborted();
      await saveFile(cache, file, signal, (received) =>
        progress(Math.min(99, Math.floor(((completed + received) / manifest.totalBytes) * 100))),
      );
      completed += file.bytes;
    }
    signal.throwIfAborted();
  }

  async open(signal: AbortSignal): Promise<ModelSession | null> {
    signal.throwIfAborted();
    const availability = await this.availability();
    if (availability.availability !== 'available') return null;
    const manifest = await this.manifest();
    if (!manifest) return null;
    signal.throwIfAborted();
    return await WebGpuModelSession.open(manifest, cacheName(manifest.id), signal);
  }

  private async manifest() {
    const request = (this.manifestRequest ??= fetchManifest());
    return await request.catch(() => {
      if (this.manifestRequest === request) this.manifestRequest = undefined;
      return null;
    });
  }

  private async missingFiles(
    id: string,
    files: readonly PhoneModelFile[],
  ): Promise<PhoneModelFile[]> {
    const responses = await Promise.all(
      files.map((file) => caches.match(file.path, { cacheName: cacheName(id) })),
    );
    return files.filter(
      (file, index) => responses[index]?.headers.get('Content-Length') !== String(file.bytes),
    );
  }
}

async function hasWebGpu(): Promise<boolean> {
  const { gpu } = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
  try {
    return !!(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function fetchManifest() {
  const response = await fetch(MANIFEST, { redirect: 'error', signal: AbortSignal.timeout(900) });
  if (!response.ok) throw new Error('Could not load the phone model manifest.');
  const manifest: unknown = await response.json();
  return readPhoneModelManifest(manifest);
}

function cacheName(id: string): string {
  return `gattsby-phone-model-${id}`;
}

async function saveFile(
  cache: Cache,
  file: PhoneModelFile,
  signal: AbortSignal,
  progress: (bytes: number) => void,
): Promise<void> {
  const response = await fetch(file.path, { redirect: 'error', signal });
  if (response.status !== 200 || !response.body)
    throw new Error('Could not download the model file.');
  let total = 0;
  const stream = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > file.bytes) throw new Error('The model file is larger than expected.');
        controller.enqueue(chunk);
        progress(total);
      },
      flush() {
        signal.throwIfAborted();
        if (total !== file.bytes) throw new Error('The model file is incomplete.');
      },
    }),
    { signal },
  );
  const data = new Response(stream, {
    headers: { 'Content-Length': String(file.bytes), 'Content-Type': 'application/octet-stream' },
  });
  await cache.put(file.path, data);
}
