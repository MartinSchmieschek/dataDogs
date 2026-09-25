import { Routes } from '@angular/router';

/**
 * Handkopie der SPA-Routen aus api/routes/routeTable.ts (SPA_ROUTES) — bei Aenderung beide pflegen.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'kennels',
    pathMatch: 'full',
  },
  {
    path: 'kennels',
    loadComponent: () => import('./pages/kennel-list/kennel-list.component')
      .then(m => m.KennelListComponent),
  },
  {
    path: 'kennels/:id',
    loadComponent: () => import('./pages/waves-viewer/waves-viewer.component')
      .then(m => m.WavesViewerComponent),
  },
  {
    path: 'kennels/:id/edit',
    loadComponent: () => import('./pages/kennel-config/kennel-config.component')
      .then(m => m.KennelConfigComponent),
  },
  {
    path: 'kennel',
    redirectTo: 'kennels',
    pathMatch: 'full',
  },
  {
    path: 'kennel/:id',
    redirectTo: 'kennels/:id',
    pathMatch: 'full',
  },
  {
    path: 'kennel/:id/edit',
    redirectTo: 'kennels/:id/edit',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'kennels',
  },
];
