import { inject, Injectable } from '@angular/core';
import { ImportError } from './import-error';
import { InvestigationStore } from './investigation-store';
import type { DeviceProfile } from './model/device-profile';
import type { ImportOutcome } from './model/import-outcome';
import { StoreError } from './store-error';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly store = inject(InvestigationStore);

  async import(file: File, signal: AbortSignal): Promise<ImportOutcome> {
    const candidate = await readImportFile(file, signal);
    if (candidate['kind'] !== 'gattsby.device-profile')
      throw new ImportError('NOT_GATTSBY', 'Choose a device profile exported by Gattsby.');
    const version = candidate['formatVersion'];
    if (version !== '1.0')
      throw new ImportError(
        'UNSUPPORTED_VERSION',
        'This format isn’t supported.',
        `This profile uses format ${version}. This version of Gattsby reads 1.0.`,
      );
    const { default: validate } = await import('../../schemas/generated/device-profile-1.js');
    if (!validate(candidate))
      throw new ImportError(
        'SCHEMA_INVALID',
        'This file doesn’t match the device profile format.',
        validate.errors?.[0]?.instancePath || undefined,
      );
    const profile = candidate as unknown as DeviceProfile;
    signal.throwIfAborted();
    try {
      const alreadyStored = await this.store.importProfile(profile, signal);
      return {
        kind: 'profile',
        id: profile.id,
        displayName: profile.identity.displayName,
        alreadyStored,
      };
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      throw importStorageError(error);
    }
  }
}

export async function readImportFile(
  file: File,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  signal.throwIfAborted();
  if (file.size > MAX_FILE_BYTES)
    throw new ImportError('FILE_TOO_LARGE', 'This file is over 20 MB, so Gattsby didn’t open it.');
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new ImportError('UNREADABLE_FILE', 'Chrome couldn’t read this file.');
  }
  signal.throwIfAborted();
  let content: unknown;
  try {
    content = JSON.parse(text, (key, value: unknown) => {
      if (FORBIDDEN_KEYS.has(key))
        throw new ImportError('FORBIDDEN_KEY', 'This file contains a disallowed object key.');
      return value;
    });
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('NOT_JSON', 'This file doesn’t contain valid JSON.');
  }
  if (!content || typeof content !== 'object' || Array.isArray(content))
    throw new ImportError('NOT_GATTSBY', 'This isn’t a Gattsby file.');
  const candidate = content as Record<string, unknown>;
  if (
    (candidate['kind'] !== 'gattsby.device-profile' &&
      candidate['kind'] !== 'gattsby.investigation-record') ||
    typeof candidate['formatVersion'] !== 'string' ||
    !/^\d{1,3}\.\d{1,3}$/.test(candidate['formatVersion'])
  )
    throw new ImportError(
      'NOT_GATTSBY',
      'This isn’t a Gattsby file.',
      'It has no recognised type and format version.',
    );
  return candidate;
}

function importStorageError(error: unknown): ImportError {
  if (error instanceof StoreError) {
    if (error.code === 'ALREADY_EXISTS')
      return new ImportError(
        'ALREADY_EXISTS',
        'A different version of this is already on this device.',
      );
    if (error.code === 'STORAGE_FULL')
      return new ImportError(
        'STORAGE_FULL',
        'There isn’t room to store it.',
        'Export and delete old investigations, then import it again.',
      );
  }
  return new ImportError('STORAGE_UNAVAILABLE', 'Chrome couldn’t save this file.');
}
