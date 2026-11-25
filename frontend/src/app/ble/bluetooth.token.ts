import { InjectionToken } from '@angular/core';

// The Web Bluetooth API, or undefined where the browser has none. Only the BLE layer injects it
// (NFR-021); a development build may provide the simulation's fake in its place.
export const BLUETOOTH = new InjectionToken<Bluetooth | undefined>('BLUETOOTH', {
  providedIn: 'root',
  factory: () => (typeof navigator === 'undefined' ? undefined : navigator.bluetooth),
});
