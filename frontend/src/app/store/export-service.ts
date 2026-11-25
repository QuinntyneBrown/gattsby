import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { APP_VERSION } from '../app-version';
import validateProfile from '../../schemas/generated/device-profile-1.js';
import { exportFileName } from './file-namer';
import { buildRecordExport } from './export-record';
import { InvestigationStore } from './investigation-store';
import type { DeviceProfile } from './model/device-profile';
import type { VerdictCommit } from './model/verdict-commit';
import { StoreError } from './store-error';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly store = inject(InvestigationStore);
  private readonly document = inject(DOCUMENT);
  private readonly appVersion = inject(APP_VERSION);

  async exportProfile(
    profile: DeviceProfile,
    includeNotes: boolean,
    signal: AbortSignal,
  ): Promise<string> {
    const header = await this.header(profile);
    const startedAt = header?.startedAt ?? Date.parse(profile.createdAt);
    const payload = {
      ...profile,
      exportedAt: new Date().toISOString(),
      appVersion: this.appVersion,
      ...(includeNotes && header?.note ? { notes: [header.note] } : {}),
    };
    if (!validateProfile(payload)) {
      throw new StoreError('UNREADABLE_PROFILE', 'The device profile couldn’t be exported.');
    }
    const name = exportFileName(profile.identity.displayName, startedAt, 'profile');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    signal.throwIfAborted();
    this.save(blob, name);
    return name;
  }

  async exportRecord(
    profile: DeviceProfile,
    includeNotesAndPhotos: boolean,
    signal: AbortSignal,
    pending?: VerdictCommit,
  ): Promise<string> {
    const { blob, startedAt } = await buildRecordExport(
      this.store,
      profile,
      includeNotesAndPhotos,
      signal,
      pending,
    );
    const name = exportFileName(profile.identity.displayName, startedAt, 'record');
    signal.throwIfAborted();
    this.save(blob, name);
    return name;
  }

  async estimateSizes(
    profile: DeviceProfile,
  ): Promise<{ profile: number; record: number | null; startedAt: number }> {
    const header = await this.header(profile);
    const profileBytes = new Blob([
      JSON.stringify(
        {
          ...profile,
          exportedAt: new Date().toISOString(),
          appVersion: this.appVersion,
        },
        null,
        2,
      ),
    ]).size;
    if (!header)
      return { profile: profileBytes, record: null, startedAt: Date.parse(profile.createdAt) };

    const [record, recordings, rawBytes] = await Promise.all([
      this.store.get(header.id),
      this.store.recordings(header.id),
      this.store.rawLogSizeEstimate(header.id),
    ]);
    const recordBytes =
      new Blob([JSON.stringify({ ...record, recordings, profile })]).size + rawBytes;
    return { profile: profileBytes, record: recordBytes, startedAt: header.startedAt };
  }

  async copySummary(profile: DeviceProfile): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!clipboard) throw new StoreError('EXPORT_UNAVAILABLE', 'The clipboard is unavailable.');
    const lines = [
      profile.identity.displayName,
      profile.verdict.label,
      profile.verdict.summary,
      ...profile.metrics.map((metric) => `${metric.label} (${metric.unit})`),
      ...profile.features.map((feature) => feature.feature),
    ];
    await clipboard.writeText(lines.join('\n'));
  }

  private async header(profile: DeviceProfile) {
    try {
      return await this.store.getInvestigation(profile.investigationId);
    } catch (error) {
      if (error instanceof StoreError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }

  private save(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = name;
      this.document.body.append(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}
