import { Service, signal, type Signal, type WritableSignal } from '@angular/core';

import type { PresenceStatus } from '../../models/presence-status/presence-status.type';
import type { PresencePort } from '../../ports/presence/presence-port.interface';

/**
 * Service LocalPresence
 *
 * @description
 * The person's presence kept in memory for the workspace it is provided in, starting at
 * `online`. It stands in for `RealtimeConnection` of `@core/realtime` until the realtime client
 * is bound to `PRESENCE`: the choice is not sent to other members and is forgotten with the
 * workspace.
 */
@Service({ autoProvided: false })
export class LocalPresence implements PresencePort {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The chosen presence.
   *
   * @type {WritableSignal<PresenceStatus>}
   * @readonly
   */
  private readonly status: WritableSignal<PresenceStatus> = signal<PresenceStatus>('online');

  /**
   * Property ownStatus
   *
   * @description
   * Presence currently chosen by the person.
   *
   * @type {Signal<PresenceStatus>}
   * @readonly
   */
  public readonly ownStatus: Signal<PresenceStatus> = this.status.asReadonly();
  // #endregion

  // #region Methods
  /**
   * Method setPresence
   *
   * @description
   * Chooses a presence.
   *
   * @param {PresenceStatus} status - The chosen presence.
   */
  public setPresence(status: PresenceStatus): void {
    this.status.set(status);
  }
  // #endregion
}
