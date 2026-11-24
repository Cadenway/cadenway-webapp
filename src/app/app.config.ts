import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { apiClientInterceptor } from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { provideAppRouting } from '@core/routing';
import { provideTheme } from '@core/theme';

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
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideTheme(),
    provideAppRouting(),
  ],
};
