import { describe, expect, it, vi } from 'vitest';
import { readImportFile } from './import-service';

const signal = new AbortController().signal;

describe('readImportFile', () => {
  it('refuses a 25 MB file before asking for its contents', async () => {
    const text = vi.fn();
    const file = { size: 25 * 1024 * 1024, text } as unknown as File;
    await expect(readImportFile(file, signal)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(text).not.toHaveBeenCalled();
  });

  it.each(['__proto__', 'prototype', 'constructor'])('refuses the nested key %s', async (key) => {
    const descriptorCount = Object.getOwnPropertyNames(Object.prototype).length;
    const body = `{"nested":{"${key}":{}}}`;
    const file = { size: body.length, text: async () => body } as File;
    await expect(readImportFile(file, signal)).rejects.toMatchObject({ code: 'FORBIDDEN_KEY' });
    expect(Object.getOwnPropertyNames(Object.prototype)).toHaveLength(descriptorCount);
  });
});
