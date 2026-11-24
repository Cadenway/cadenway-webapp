import { type Provider } from '@angular/core';

import { RealtimeConnection } from './realtime-connection.service';

export { RealtimeConnection } from './realtime-connection.service';
export { REALTIME_ORGANIZATION, REALTIME_TICKET_SOURCE } from './realtime.token';
export type {
  MemberPresenceChange,
  PresenceStatus,
  RealtimeChange,
  RealtimeRoom,
} from './realtime.types';

/**
 * Function provideRealtime
 *
 * @description
 * Provides one connection in the owning workspace injector.
 *
 * @returns {Provider[]} Route-scoped connection providers.
 */
export function provideRealtime(): Provider[] {
  return [RealtimeConnection];
}
