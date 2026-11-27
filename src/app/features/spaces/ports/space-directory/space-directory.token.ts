import { InjectionToken } from '@angular/core';

import type { SpaceDirectoryPort } from './space-directory-port.interface';

/**
 * Constant SPACE_DIRECTORY
 *
 * @description
 * The spaces of the workspace, provided on `/:org` by `provideSpacesNavigation()` from the
 * sidebar's `SpacesNavigationStore`, so no other read is made. Inject it as optional from code
 * that may also run outside a workspace.
 *
 * @type {InjectionToken<SpaceDirectoryPort>}
 */
export const SPACE_DIRECTORY: InjectionToken<SpaceDirectoryPort> =
  new InjectionToken<SpaceDirectoryPort>('SPACE_DIRECTORY');
