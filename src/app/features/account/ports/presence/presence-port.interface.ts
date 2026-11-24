import type { Signal } from '@angular/core';

import type { PresenceStatus } from '../../models/presence-status/presence-status.type';

/**
 * Interface PresencePort
 *
 * @description
 * The signed-in person's own presence, as the account menu changes it and the inbox reads it. It
 * is the subset of `RealtimeConnection` (`@core/realtime`) the shell needs, so the realtime
 * connection can be bound to it without changing its readers.
 */
export interface PresencePort {
  // #region Properties
  /**
   * Property ownStatus
   *
   * @description
   * Presence currently chosen by the person.
   *
   * @type {Signal<PresenceStatus>}
   * @readonly
   */
  readonly ownStatus: Signal<PresenceStatus>;
  // #endregion

  // #region Methods
  /**
   * Method setPresence
   *
   * @description
   * Chooses a presence; `ownStatus` follows at once.
   *
   * @param {PresenceStatus} status - The chosen presence.
   */
  setPresence(status: PresenceStatus): void;
  // #endregion
}
