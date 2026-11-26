import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { appConfig } from './app/app.config';
import { AppShell } from './app/app-shell';
import { SERVICE_WORKER_SCRIPT } from './app/security/script-url-allowlist';
import { installTrustedTypesPolicy, trustedScriptUrl } from './app/security/trusted-types-policy';

installTrustedTypesPolicy();
const workerUrl = trustedScriptUrl(SERVICE_WORKER_SCRIPT);
bootstrapApplication(AppShell, {
  providers: [
    ...appConfig.providers,
    provideServiceWorker(workerUrl, {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
}).catch((error: unknown) => console.error(error));
