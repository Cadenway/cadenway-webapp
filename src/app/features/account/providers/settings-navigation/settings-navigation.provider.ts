import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { AccountSettingsLink } from '../../ui/components/account-settings-link/account-settings-link.component';
import { AccountSettingsNavigation } from '../../ui/components/account-settings-navigation/account-settings-navigation.component';

/**
 * Function withAccountSettingsNavigation
 *
 * @description
 * Contributes the `My account` group with the 5 account sections to the settings shell's
 * `settingsNavigation` slot, after the back link (order 10). Bind it on the account settings
 * route below `/:org`, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withAccountSettingsNavigation(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'account.settings-navigation',
      order: 10,
      component: AccountSettingsNavigation,
    }),
  };
}

/**
 * Function withAccountSettingsLink
 *
 * @description
 * Contributes the `My account` group with `Profile and security`, last in the organization
 * settings' `settingsNavigation` slot (order 20). Bind it on the organization settings route
 * below `/:org`, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withAccountSettingsLink(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'account.settings-link',
      order: 20,
      component: AccountSettingsLink,
    }),
  };
}
