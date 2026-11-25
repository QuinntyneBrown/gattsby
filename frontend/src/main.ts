import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppShell } from './app/app-shell';
import { installTrustedTypesPolicy } from './app/security/trusted-types-policy';

installTrustedTypesPolicy();
bootstrapApplication(AppShell, appConfig).catch((error: unknown) => console.error(error));
