import type { Provider } from '@angular/core';

import { RealtimeConnection } from '@core/realtime';

import { PRESENCE } from '../../ports/presence/presence.token';

/**
 * Function providePresence
 *
 * @description
 * Binds `PRESENCE` to the workspace's realtime connection. Give it to the `/:org` route, after the
 * workspace runtime that provides `RealtimeConnection`, so the account menu and the inbox share
 * the person's presence.
 *
 * @returns {Provider[]} The presence port.
 */
export function providePresence(): Provider[] {
  return [{ provide: PRESENCE, useExisting: RealtimeConnection }];
}
