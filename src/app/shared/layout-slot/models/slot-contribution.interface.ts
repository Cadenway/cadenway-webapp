import type { Type } from '@angular/core';

/**
 * Interface SlotContribution
 *
 * @description
 * Component contributed to an additive layout slot. Every contribution of a slot renders, in
 * ascending `order`, through `NgComponentOutlet`; the layout never imports the contributing
 * feature.
 */
export interface SlotContribution {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Stable identifier, unique within the slot, used to track the rendered component.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property order
   *
   * @description
   * Position among the slot's contributions, ascending. Contributions with the same order keep
   * their registration order.
   *
   * @type {number}
   * @readonly
   */
  readonly order: number;

  /**
   * Property component
   *
   * @description
   * Standalone component the layout renders with `NgComponentOutlet`.
   *
   * @type {Type<unknown>}
   * @readonly
   */
  readonly component: Type<unknown>;

  /**
   * Property inputs
   *
   * @description
   * Optional input values set on the rendered component, keyed by input name.
   *
   * @type {Readonly<Record<string, unknown>> | undefined}
   * @readonly
   */
  readonly inputs?: Readonly<Record<string, unknown>>;
  // #endregion
}
