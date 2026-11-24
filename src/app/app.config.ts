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
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';

import { apiClientInterceptor } from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { provideAppRouting } from '@core/routing';
import { provideTheme } from '@core/theme';
import { RouteErrorPage } from '@features/errors';

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
    // parameters. A routed page that fails renders `RouteErrorPage` in its outlet; the failure is
    // still reported to the application's error handler.
    provideRouter(
      APP_ROUTES,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withErrorBoundaries({
        defaultErrorComponent: RouteErrorPage,
        onError: (error: Error): void => {
          inject(ErrorHandler).handleError(error);
        },
      }),
    ),
    provideTheme(),
    provideAppRouting(),
  ],
};
