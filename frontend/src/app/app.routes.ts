import { Routes } from '@angular/router';

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
    path: '**',
    title: 'Not found · Gattsby',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
