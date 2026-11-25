import { InjectionToken } from '@angular/core';

import type { ListDirectoryPort } from './list-directory-port.interface';

/**
 * Constant LIST_DIRECTORY
 *
 * @description
 * The lists of the workspace, provided on `/:org` by `provideSpacesNavigation()` from the
 * sidebar's `SpacesNavigationStore`, so no other read is made. Inject it as optional from code
 * that may also run outside a workspace.
 *
 * @type {InjectionToken<ListDirectoryPort>}
 */
export const LIST_DIRECTORY: InjectionToken<ListDirectoryPort> =
  new InjectionToken<ListDirectoryPort>('LIST_DIRECTORY');
