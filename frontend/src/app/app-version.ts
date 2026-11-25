import { InjectionToken } from '@angular/core';
import packageJson from '../../package.json';

// The app version from package.json, recorded on every investigation (FR-007).
export const APP_VERSION = new InjectionToken<string>('APP_VERSION', {
  providedIn: 'root',
  factory: () => packageJson.version,
});
