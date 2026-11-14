import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { RuntimeConfigStore } from '@core/config';

import { APP_ROUTES } from './app.routes';

/** Root providers of the application. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The gateway addresses must be known before anything calls the API.
    provideAppInitializer(() => inject(RuntimeConfigStore).load()),
    provideRouter(APP_ROUTES),
  ],
};
