import { describe, expect, it } from 'vitest';
import { exportFileName } from './file-namer';

describe('exportFileName', () => {
  const date = new Date(2026, 10, 25).getTime();

  it('uses a safe filename and the investigation’s local calendar date', () => {
    expect(exportFileName(' Élan / ../ T202 ', date, 'profile')).toBe(
      'elan-t202-2026-11-25-profile.gattsby.json',
    );
  });

  it('falls back for names with no usable characters and bounds the slug', () => {
    expect(exportFileName('🔥', date, 'record')).toBe('device-2026-11-25-record.gattsby.json');
    expect(exportFileName('a'.repeat(80), date, 'profile').split('-')[0]).toHaveLength(40);
  });
});
