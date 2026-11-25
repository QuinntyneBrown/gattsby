import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { BleLayer } from './ble/ble-layer';
import { WebBluetoothBleLayer } from './ble/web-bluetooth-ble-layer';
import { BrowserCapabilityDetector } from './environment/browser-capability-detector';
import { CapabilityDetector } from './environment/capability-detector';
import { routes } from './app.routes';
import { IndexedDbInvestigationStore } from './store/indexed-db-investigation-store';
import { InvestigationStore } from './store/investigation-store';

// Each contract's implementation (AGENTS.md "Frontend": components depend on the contract).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: BleLayer, useClass: WebBluetoothBleLayer },
    { provide: InvestigationStore, useClass: IndexedDbInvestigationStore },
    { provide: CapabilityDetector, useClass: BrowserCapabilityDetector },
  ],
};
