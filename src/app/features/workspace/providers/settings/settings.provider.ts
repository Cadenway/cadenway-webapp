import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { BackToAppLink } from '../../ui/components/back-to-app-link/back-to-app-link.component';
import { OrganizationHomeItem } from '../../ui/components/organization-home-item/organization-home-item.component';

/**
 * Function withBackToApp
 *
 * @description
 * Contributes `Back to the application`, first in the settings shell's `settingsNavigation` slot.
 * Bind it on a settings route below `/:org`, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withBackToApp(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'workspace.back-to-app',
      order: 0,
      component: BackToAppLink,
    }),
  };
}

/**
 * Function withOrganizationHomeItem
 *
 * @description
 * Contributes the organization square back to Home, first in the settings shell's
 * `railNavigation` slot (order -10, before Home's item), with its separator. Bind it on a
 * settings route below `/:org`, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withOrganizationHomeItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'workspace.organization-home',
      order: -10,
      component: OrganizationHomeItem,
    }),
  };
}
