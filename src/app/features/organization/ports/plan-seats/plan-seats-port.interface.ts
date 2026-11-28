import type { Signal } from '@angular/core';

/**
 * Interface PlanSeats
 *
 * @description
 * The organization's plan and the seats still free on it.
 */
export interface PlanSeats {
  // #region Properties
  /**
   * Property plan
   *
   * @description
   * The plan key served by the contract (`free`, `team`, `enterprise` or a later one).
   *
   * @type {string}
   * @readonly
   */
  readonly plan: string;

  /**
   * Property free
   *
   * @description
   * Seats left on the plan, never below zero.
   *
   * @type {number}
   * @readonly
   */
  readonly free: number;
  // #endregion
}

/**
 * Interface PlanSeatsPort
 *
 * @description
 * The plan and free seats of the workspace's organization, read once by Organization's shared
 * `SubscriptionStore`. Only the owner may read the subscription, so `seats` stays null for the
 * other roles, while it loads, after a failed read and once a refusal cleared it.
 */
export interface PlanSeatsPort {
  // #region Properties
  /**
   * Property seats
   *
   * @description
   * The plan and its free seats, or null while unknown.
   *
   * @type {Signal<PlanSeats | null>}
   * @readonly
   */
  readonly seats: Signal<PlanSeats | null>;
  // #endregion
}
