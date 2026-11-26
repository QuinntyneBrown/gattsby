import type { PhoneModelFile } from './phone-model-file';

export interface PhoneModelManifest {
  readonly id: string;
  readonly contextWindow: number;
  readonly files: readonly PhoneModelFile[];
  readonly totalBytes: number;
}

export function readPhoneModelManifest(value: unknown): PhoneModelManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, contextWindow, files } = value as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) ||
    typeof contextWindow !== 'number' ||
    !Number.isSafeInteger(contextWindow) ||
    contextWindow <= 512 ||
    !Array.isArray(files) ||
    files.length === 0 ||
    files.length > 128
  ) {
    return null;
  }
  const paths = new Set<string>();
  const modelFiles: PhoneModelFile[] = [];
  let totalBytes = 0;
  for (const file of files as unknown[]) {
    if (typeof file !== 'object' || file === null) return null;
    const { path, bytes } = file as Record<string, unknown>;
    if (
      typeof path !== 'string' ||
      !/^\/phone-model\/assets\/[a-z0-9][a-z0-9._-]{0,127}$/.test(path) ||
      paths.has(path) ||
      typeof bytes !== 'number' ||
      !Number.isSafeInteger(bytes) ||
      bytes < 1
    ) {
      return null;
    }
    paths.add(path);
    modelFiles.push({ path, bytes });
    totalBytes += bytes;
  }
  return Number.isSafeInteger(totalBytes)
    ? { id, contextWindow, files: modelFiles, totalBytes }
    : null;
}
