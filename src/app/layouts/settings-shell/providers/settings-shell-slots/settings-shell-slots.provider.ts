import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { type SlotContribution, type SlotFeature, slotProviders } from '@shared/layout-slot';

import {
  SETTINGS_SHELL_RAIL_FOOTER_SLOT,
  SETTINGS_SHELL_RAIL_NAVIGATION_SLOT,
  SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT,
} from '../../slots';

/**
 * Interface SettingsShellSlots
 *
 * @description
 * Contributions a route gives the settings shell. An omitted list leaves its slot empty.
 */
export interface SettingsShellSlots {
  // #region Properties
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
   * Property settingsNavigation
   *
   * @description
   * Groups of the 240 px settings navigation.
   *
   * @type {readonly SlotFeature<SlotContribution>[] | undefined}
   * @readonly
   */
  readonly settingsNavigation?: readonly SlotFeature<SlotContribution>[];
  // #endregion
}

/**
 * Function provideSettingsShellSlots
 *
 * @description
 * Registers settings shell contributions as multi providers. Call it in the `providers` of the
 * route that loads `SettingsShell`: the layout reads its slots from that route's injector when it
 * is created, so contributions in a child route's providers never reach it, and several calls in
 * the same route add up. A routed page changes the shell through the core page-to-shell services
 * instead.
 *
 * @param {SettingsShellSlots} config - Contributions per slot.
 * @returns {EnvironmentProviders} Environment providers for the configured slots.
 */
export function provideSettingsShellSlots(config: SettingsShellSlots): EnvironmentProviders {
  return makeEnvironmentProviders([
    ...slotProviders(SETTINGS_SHELL_RAIL_NAVIGATION_SLOT, config.railNavigation),
    ...slotProviders(SETTINGS_SHELL_RAIL_FOOTER_SLOT, config.railFooter),
    ...slotProviders(SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT, config.settingsNavigation),
  ]);
}
