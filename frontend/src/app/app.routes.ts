import { Routes } from '@angular/router';
import { investigationExists } from './pages/investigation/investigation-exists.guard';

// One lazy route per page (NFR-004; serve-offline-and-private design). The last route catches
// every address no other route matches.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Gattsby',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'investigations/:id',
    canMatch: [investigationExists],
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
    path: '**',
    title: 'Not found · Gattsby',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
