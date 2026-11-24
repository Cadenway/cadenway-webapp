import { InjectionToken } from '@angular/core';

import type { PresencePort } from './presence-port.interface';

/**
 * Constant PRESENCE
 *
 * @description
 * The signed-in person's own presence inside a workspace, provided on the `/:org` route by
 * `providePresence()` of the account providers. Inject it as optional from code that may run
 * outside a workspace.
 *
 * @type {InjectionToken<PresencePort>}
 */
export const PRESENCE: InjectionToken<PresencePort> = new InjectionToken<PresencePort>('PRESENCE');
