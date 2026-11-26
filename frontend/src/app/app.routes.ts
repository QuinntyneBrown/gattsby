import { Routes } from '@angular/router';
import { investigationExists } from './pages/investigation/investigation-exists.guard';
import { leaveInvestigation } from './pages/investigation/leave-investigation.guard';
import { readinessOnLaunch } from './pages/readiness/readiness.guard';

// One lazy route per page (NFR-004; serve-offline-and-private design). The last route catches
// every address no other route matches.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [readinessOnLaunch],
    title: 'Gattsby',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'start',
    title: 'Readiness check · Gattsby',
    loadComponent: () => import('./pages/readiness/readiness.page').then((m) => m.ReadinessPage),
  },
  {
    path: 'investigations/:id',
    canMatch: [investigationExists],
    canDeactivate: [leaveInvestigation],
    title: 'Investigation · Gattsby',
    loadComponent: () =>
      import('./pages/investigation/investigation.page').then((m) => m.InvestigationPage),
  },
  {
    path: 'investigations/:id/verdict',
    canMatch: [investigationExists],
    title: 'Verdict · Gattsby',
    loadComponent: () => import('./pages/verdict/verdict.page').then((m) => m.VerdictPage),
  },
  {
    path: 'profiles/:id',
    title: 'Device profile · Gattsby',
    loadComponent: () =>
      import('./pages/device-profile/device-profile.page').then((m) => m.DeviceProfilePage),
  },
  {
    path: 'settings',
    title: 'Settings · Gattsby',
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: '**',
    title: 'Not found · Gattsby',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
