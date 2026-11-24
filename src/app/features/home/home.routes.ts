import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

/**
 * Constant HOME_ROUTES
 *
 * @description
 * The home screen, mounted at the root of a workspace (`/:org`).
 *
 * @type {Routes}
 */
export const HOME_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: $localize`:@@home.route.title:Home`,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/home-page/home-page.component')).HomePage,
  },
];
