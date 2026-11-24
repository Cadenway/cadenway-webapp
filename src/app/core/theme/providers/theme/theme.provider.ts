import {
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';

import { ThemeService } from '../../services/theme/theme.service';

/**
 * Function provideTheme
 *
 * @description
 * Starts theme synchronization during application initialization.
 * @returns {EnvironmentProviders} Providers that initialize document theme synchronization.
 */
export function provideTheme(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ]);
}
