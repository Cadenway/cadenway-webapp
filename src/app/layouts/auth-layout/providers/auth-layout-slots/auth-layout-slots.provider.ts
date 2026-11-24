import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { type SlotContribution, type SlotFeature, slotProviders } from '@shared/layout-slot';

import { AUTH_FOOTER_LINKS_SLOT, AUTH_HEADER_ACTIONS_SLOT } from '../../slots';

/**
 * Interface AuthLayoutSlots
 *
 * @description
 * Contributions a route gives the sign-in frame. An omitted list leaves its slot empty.
 */
export interface AuthLayoutSlots {
  // #region Properties
  /**
   * Property headerActions
   *
   * @description
   * Actions at the right of the header, such as the theme toggle.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly headerActions?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property footerLinks
   *
   * @description
   * Entries of the footer, such as the privacy, terms and help links.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly footerLinks?: readonly SlotFeature<SlotContribution>[];
  // #endregion
}

/**
 * Function provideAuthLayoutSlots
 *
 * @description
 * Registers sign-in frame contributions as multi providers. Call it in the `providers` of the route
 * that loads `AuthLayout`: the layout reads its slots from that route's injector when it is
 * created, so contributions in a child route's providers never reach it, and several calls in the
 * same route add up. A routed page changes the shell through the core page-to-shell services
 * instead.
 *
 * @param {AuthLayoutSlots} config - Contributions per slot.
 * @returns {EnvironmentProviders} Environment providers for the configured slots.
 */
export function provideAuthLayoutSlots(config: AuthLayoutSlots): EnvironmentProviders {
  return makeEnvironmentProviders([
    ...slotProviders(AUTH_HEADER_ACTIONS_SLOT, config.headerActions),
    ...slotProviders(AUTH_FOOTER_LINKS_SLOT, config.footerLinks),
  ]);
}
