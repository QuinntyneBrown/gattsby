import { expect, it } from 'vitest';
import { readPhoneModelManifest } from './phone-model-manifest';

const manifest = {
  id: 'phone-v1',
  contextWindow: 4096,
  files: [
    { path: '/phone-model/assets/weights.bin', bytes: 1024 },
    { path: '/phone-model/assets/tokenizer.json', bytes: 1024 },
  ],
};

it('derives download size from the package file lengths', () => {
  expect(readPhoneModelManifest(manifest)).toEqual({ ...manifest, totalBytes: 2048 });
});

it.each([
  null,
  { ...manifest, contextWindow: 512 },
  { ...manifest, files: [manifest.files[0], manifest.files[0]] },
  { ...manifest, files: [{ path: '/phone-model/assets/../worker.js', bytes: 1024 }] },
  { ...manifest, files: [{ path: '//somewhere.invalid/weights.bin', bytes: 1024 }] },
  { ...manifest, files: [{ path: '/phone-model/assets/weights.bin', bytes: 0 }] },
])('refuses to offer an invalid or disabled package', (value) => {
  expect(readPhoneModelManifest(value)).toBeNull();
});
