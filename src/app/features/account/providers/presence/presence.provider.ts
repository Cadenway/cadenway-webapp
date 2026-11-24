import type { Provider } from '@angular/core';

import { PRESENCE } from '../../ports/presence/presence.token';
import { LocalPresence } from '../../services/local-presence/local-presence.service';

/**
 * Function providePresence
 *
 * @description
 * Provides `PRESENCE` for one workspace. Give it to the `/:org` route, next to the shell slots,
 * so the account menu and the inbox share the person's presence. It binds the in-memory
 * `LocalPresence` until the realtime connection of `@core/realtime` takes its place.
 *
 * @returns {Provider[]} The presence and its port.
 */
export function providePresence(): Provider[] {
  return [LocalPresence, { provide: PRESENCE, useExisting: LocalPresence }];
}
