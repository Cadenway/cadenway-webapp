/**
 * Type PresenceStatus
 *
 * @description
 * A member's private presence preference.
 *
 * @type {'online' | 'away' | 'do-not-disturb' | 'invisible'}
 */
export type PresenceStatus = 'online' | 'away' | 'do-not-disturb' | 'invisible';

/**
 * Interface MemberPresenceChange
 *
 * @description
 * A membership's publicly visible presence.
 */
export interface MemberPresenceChange {
  // #region Properties
  /**
   * Property memberId
   *
   * @description
   * Identifier of the membership in the current organization.
   *
   * @type {string}
   * @readonly
   */
  readonly memberId: string;

  /**
   * Property status
   *
   * @description
   * Public status, including offline for invisible members.
   *
   * @type {'online' | 'away' | 'do-not-disturb' | 'offline'}
   * @readonly
   */
  readonly status: 'online' | 'away' | 'do-not-disturb' | 'offline';
  // #endregion
}

/**
 * Type RealtimeRoom
 *
 * @description
 * A resource subscription authorized by the gateway.
 *
 * @type {{ readonly kind: 'list'; readonly listId: string } | { readonly kind: 'task'; readonly taskKey: string }}
 */
export type RealtimeRoom =
  | { readonly kind: 'list'; readonly listId: string }
  | { readonly kind: 'task'; readonly taskKey: string };

/**
 * Interface RealtimeChange
 *
 * @description
 * A validated browser invalidation. Consumers use its payload to decide what to refresh.
 */
export interface RealtimeChange {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Stable deduplication identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property type
   *
   * @description
   * Browser notice type.
   *
   * @type {string}
   * @readonly
   */
  readonly type: string;

  /**
   * Property at
   *
   * @description
   * UTC time of the originating fact.
   *
   * @type {string}
   * @readonly
   */
  readonly at: string;

  /**
   * Property data
   *
   * @description
   * Validated notice-specific payload.
   *
   * @type {unknown}
   * @readonly
   */
  readonly data: unknown;
  // #endregion
}

/**
 * Type PersonalNotice
 *
 * @description
 * Validated invalidation delivered to the signed-in member's room.
 *
 * @type {{ type: 'notification.created.v1' } | { type: 'reminder.due.v1'; reminderId: string; taskId: string }}
 */
export type PersonalNotice =
  | { type: 'notification.created.v1' }
  | { type: 'reminder.due.v1'; reminderId: string; taskId: string };
