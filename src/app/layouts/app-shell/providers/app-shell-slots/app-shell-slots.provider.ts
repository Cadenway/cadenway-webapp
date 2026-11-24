import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { type SlotContribution, type SlotFeature, slotProviders } from '@shared/layout-slot';

import {
  APP_SHELL_BANNERS_SLOT,
  APP_SHELL_ORGANIZATION_SWITCHER_SLOT,
  APP_SHELL_OVERLAYS_SLOT,
  APP_SHELL_RAIL_FOOTER_SLOT,
  APP_SHELL_RAIL_NAVIGATION_SLOT,
  APP_SHELL_SIDEBAR_FOOTER_SLOT,
  APP_SHELL_SIDEBAR_HEADER_SLOT,
  APP_SHELL_SIDEBAR_SLOT,
} from '../../slots';

/**
 * Interface AppShellSlots
 *
 * @description
 * Contributions a route gives the application shell. An omitted list leaves its slot empty.
 */
export interface AppShellSlots {
  // #region Properties
  /**
   * Property banners
   *
   * @description
   * Application-wide banners above the rail and the main panel.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly banners?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property organizationSwitcher
   *
   * @description
   * Organization switcher, first in the rail and hidden from the phone tab bar.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly organizationSwitcher?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property railNavigation
   *
   * @description
   * Rail groups, each rendering its own `cw-app-rail-group`.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly railNavigation?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property railFooter
   *
   * @description
   * Rail items pushed to the bottom of the rail.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly railFooter?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property sidebarHeader
   *
   * @description
   * Non-scrolling header rows of the space sidebar.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly sidebarHeader?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property sidebar
   *
   * @description
   * Scrolling body of the space sidebar.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly sidebar?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property sidebarFooter
   *
   * @description
   * Rows of the sidebar footer.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly sidebarFooter?: readonly SlotFeature<SlotContribution>[];

  /**
   * Property overlays
   *
   * @description
   * Application-wide overlays rendered after the shell.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly overlays?: readonly SlotFeature<SlotContribution>[];
  // #endregion
}

/**
 * Function provideAppShellSlots
 *
 * @description
 * Registers application shell contributions as multi providers. Call it in the `providers` of the
 * route that loads `AppShell`: the layout reads its slots from that route's injector when it is
 * created, so contributions in a child route's providers never reach it, and several calls in the
 * same route add up. A routed page changes the shell through the core page-to-shell services
 * instead.
 *
 * @param {AppShellSlots} config - Contributions per slot.
 * @returns {EnvironmentProviders} Environment providers for the configured slots.
 */
export function provideAppShellSlots(config: AppShellSlots): EnvironmentProviders {
  return makeEnvironmentProviders([
    ...slotProviders(APP_SHELL_BANNERS_SLOT, config.banners),
    ...slotProviders(APP_SHELL_ORGANIZATION_SWITCHER_SLOT, config.organizationSwitcher),
    ...slotProviders(APP_SHELL_RAIL_NAVIGATION_SLOT, config.railNavigation),
    ...slotProviders(APP_SHELL_RAIL_FOOTER_SLOT, config.railFooter),
    ...slotProviders(APP_SHELL_SIDEBAR_HEADER_SLOT, config.sidebarHeader),
    ...slotProviders(APP_SHELL_SIDEBAR_SLOT, config.sidebar),
    ...slotProviders(APP_SHELL_SIDEBAR_FOOTER_SLOT, config.sidebarFooter),
    ...slotProviders(APP_SHELL_OVERLAYS_SLOT, config.overlays),
  ]);
}
