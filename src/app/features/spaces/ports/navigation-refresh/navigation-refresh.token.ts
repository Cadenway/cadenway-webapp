import { InjectionToken } from '@angular/core';

import type { NavigationRefreshPort } from './navigation-refresh-port.interface';

/**
 * Constant NAVIGATION_REFRESH
 *
 * @description
 * Refreshes the sidebar's reads, provided on `/:org` by `provideSpacesNavigation()` over the
 * sidebar's `SpacesNavigationStore`. Inject it as optional from code that may also run outside a
 * workspace.
 *
 * @type {InjectionToken<NavigationRefreshPort>}
 */
export const NAVIGATION_REFRESH: InjectionToken<NavigationRefreshPort> =
  new InjectionToken<NavigationRefreshPort>('NAVIGATION_REFRESH');
