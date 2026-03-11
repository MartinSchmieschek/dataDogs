import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/kennel-list/kennel-list.component')
      .then(m => m.KennelListComponent),
  },
  {
    path: 'kennel/:id',
    loadComponent: () => import('./pages/waves-viewer/waves-viewer.component')
      .then(m => m.WavesViewerComponent),
  },
  {
    path: 'kennel/:id/edit',
    loadComponent: () => import('./pages/kennel-config/kennel-config.component')
      .then(m => m.KennelConfigComponent),
  },
];
