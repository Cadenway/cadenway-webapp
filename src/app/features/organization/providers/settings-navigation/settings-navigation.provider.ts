import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { OrganizationSettingsLinks } from '../../ui/components/organization-settings-links/organization-settings-links.component';
import { OrganizationSettingsNavigation } from '../../ui/components/organization-settings-navigation/organization-settings-navigation.component';

/**
 * Function withOrganizationSettingsNavigation
 *
 * @description
 * Contributes the identity row and the `Organization` group of the sections the person's role
 * may open to the settings shell's `settingsNavigation` slot, after the back link (order 10).
 * Bind it on the organization settings route below `/:org`, whose injector provides
 * `WORKSPACE_CONTEXT` and `SubscriptionStore` (`provideOrganizationUsage()`).
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withOrganizationSettingsNavigation(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'organization.settings-navigation',
      order: 10,
      component: OrganizationSettingsNavigation,
    }),
  };
}

/**
 * Function withOrganizationSettingsLinks
 *
 * @description
 * Contributes the `Organization · <name>` group (General, Members, Billing, Quotas and usage,
 * filtered by role) last in the account settings' `settingsNavigation` slot (order 20). Bind it
 * on the account settings route below `/:org`, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withOrganizationSettingsLinks(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'organization.settings-links',
      order: 20,
      component: OrganizationSettingsLinks,
    }),
  };
}
