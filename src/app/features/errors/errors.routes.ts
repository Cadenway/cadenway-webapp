import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

import { provideCadenwayUiLabels } from '@core/ui-labels';
import { NotFoundRouteError } from '@shared/route-errors';

/**
 * Constant ERRORS_ROUTES
 *
 * @description
 * The 404 of an unknown address, mounted after the known routes at the root and inside a
 * workspace, where it renders in the shell. The page keeps the unknown address in the browser and
 * makes no lookup; its `error` input comes from the route `data`. The route provides the icons and the
 * application-wide brick labels, which the root mount has no layout to provide.
 *
 * @type {Routes}
 */
export const ERRORS_ROUTES: Routes = [
  {
    path: '**',
    providers: [provideCadenwayIcons(), provideCadenwayUiLabels()],
    title: $localize`:@@errors.not-found.route-title:Page not found`,
    data: { error: new NotFoundRouteError() },
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/components/route-error-boundary/route-error-boundary.component'))
        .RouteErrorBoundary,
  },
];
