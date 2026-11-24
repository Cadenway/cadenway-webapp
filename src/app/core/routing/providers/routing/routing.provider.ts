import {
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { TitleStrategy } from '@angular/router';

import { RouteFocusService } from '../../services/route-focus/route-focus.service';
import { PageTitleStrategy } from '../../strategies/page-title/page-title.service';

/**
 * Function provideAppRouting
 *
 * @description
 * Configures route titles and focus management.
 * @returns {EnvironmentProviders} The resulting value.
 */
export function provideAppRouting(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideAppInitializer(() => {
      inject(RouteFocusService);
    }),
  ]);
}
