import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { APP_VERSION } from '../app-version';
import validateProfile from '../../schemas/generated/device-profile-1.js';
import { exportFileName } from './file-namer';
import { InvestigationStore } from './investigation-store';
import type { DeviceProfile } from './model/device-profile';
import { StoreError } from './store-error';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly store = inject(InvestigationStore);
  private readonly document = inject(DOCUMENT);
  private readonly appVersion = inject(APP_VERSION);

  async exportProfile(profile: DeviceProfile): Promise<string> {
    const startedAt = await this.startTime(profile);
    const payload = {
      ...profile,
      exportedAt: new Date().toISOString(),
      appVersion: this.appVersion,
    };
    if (!validateProfile(payload)) {
      throw new StoreError('UNREADABLE_PROFILE', 'The device profile couldn’t be exported.');
    }
    const name = exportFileName(profile.identity.displayName, startedAt, 'profile');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    this.save(blob, name);
    return name;
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

  private async startTime(profile: DeviceProfile): Promise<number> {
    try {
      return (await this.store.get(profile.investigationId)).investigation.startedAt;
    } catch (error) {
      if (error instanceof StoreError && error.code === 'NOT_FOUND')
        return Date.parse(profile.createdAt);
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
