import type { Signal } from '@angular/core';

import type { PresenceStatus } from '@core/realtime';

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
   * Presence the person chose in this tab, or null until they choose one: the gateway keeps the
   * saved preference and the connection's `hello` does not return it.
   *
   * @type {Signal<PresenceStatus | null>}
   * @readonly
   */
  readonly ownStatus: Signal<PresenceStatus | null>;

  /**
   * Property status
   *
   * @description
   * State of the realtime connection; `disabled` when no realtime gateway is configured, in which
   * case a chosen presence is never sent.
   *
   * @type {Signal<'disabled' | 'connecting' | 'connected' | 'reconnecting'>}
   * @readonly
   */
  readonly status: Signal<'disabled' | 'connecting' | 'connected' | 'reconnecting'>;
  // #endregion

  // #region Methods
  /**
   * Method setPresence
   *
   * @description
   * Chooses a presence and sends it to the gateway; `ownStatus` follows at once, and returns to
   * the last confirmed presence when the gateway refuses it.
   *
   * @param {PresenceStatus} status - The chosen presence.
   */
  setPresence(status: PresenceStatus): void;
  // #endregion
}
