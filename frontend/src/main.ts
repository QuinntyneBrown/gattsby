import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { appConfig } from './app/app.config';
import { AppShell } from './app/app-shell';
import { installTrustedTypesPolicy } from './app/security/trusted-types-policy';

const workerUrl = installTrustedTypesPolicy();
bootstrapApplication(AppShell, {
  providers: [
    ...appConfig.providers,
    provideServiceWorker(workerUrl, {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
}).catch((error: unknown) => console.error(error));
