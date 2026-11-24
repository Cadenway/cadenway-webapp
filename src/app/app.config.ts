import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withAutoCleanupInjectors,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';

import { apiClientInterceptor } from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { provideAppRouting } from '@core/routing';
import { provideTheme } from '@core/theme';
import { RouteErrorBoundary } from '@features/errors';

import { APP_ROUTES } from './app.routes';

/**
 * Constant appConfig
 *
 * @description
 * Root providers of the application.
 *
 * @type {ApplicationConfig}
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The REST gateway address must be known before anything calls the API.
    provideAppInitializer(() => inject(RuntimeConfigStore).load()),
    provideHttpClient(withInterceptors([apiClientInterceptor])),
    // Parameters, query parameters and data reach pages as inputs, a child seeing its ancestors'
    // parameters. Leaving a route destroys the environment injector of its providers, so the
    // route-scoped stores (AuthFlowStore, WorkspaceContextStore) die with it. A routed page that
    // fails renders `RouteErrorBoundary` in its outlet; the failure is still reported to the
    // application's error handler.
    provideRouter(
      APP_ROUTES,
      withComponentInputBinding(),
      withAutoCleanupInjectors(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withErrorBoundaries({
        defaultErrorComponent: RouteErrorBoundary,
        onError: (error: Error): void => {
          inject(ErrorHandler).handleError(error);
        },
      }),
    ),
    provideTheme(),
    provideAppRouting(),
  ],
};
