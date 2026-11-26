import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

/**
 * Constant INTAKE_ROUTES
 *
 * @description
 * The public request form of a list, mounted below `/f` by `APP_ROUTES`: `:publicKey` is the
 * opaque key of its publication, the only part of the link the editor copies. The page needs no
 * session and renders without a shell; a failed read renders the default error boundary.
 *
 * @type {Routes}
 */
export const INTAKE_ROUTES: Routes = [
  {
    path: ':publicKey',
    providers: [provideCadenwayIcons()],
    title: $localize`:@@intake.route.title:Request form`,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/intake-page/intake-page.component')).IntakePage,
  },
];
