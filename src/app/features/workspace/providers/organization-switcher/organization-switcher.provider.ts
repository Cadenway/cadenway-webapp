import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { OrganizationSwitcher } from '../../ui/components/organization-switcher/organization-switcher.component';

/**
 * Function withOrganizationSwitcher
 *
 * @description
 * Contributes the organization switcher to the shell's `organizationSwitcher` slot: the rail
 * square with the organization's initials, opening the organizations menu. Bind it on the
 * `/:org` route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withOrganizationSwitcher(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'workspace.organization-switcher',
      order: 0,
      component: OrganizationSwitcher,
    }),
  };
}

/**
 * Function withOrganizationRow
 *
 * @description
 * Contributes the organization row to the shell's `sidebarHeader` slot, first: the Cadenway mark,
 * the organization's name, `<host>/<slug>` and a caret, opening the same organizations menu as the
 * rail square. It is the phone entry point, since the rail square is desktop only. Bind it on the
 * `/:org` route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withOrganizationRow(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'workspace.organization-row',
      order: 0,
      component: OrganizationSwitcher,
      inputs: { placement: 'sidebar' },
    }),
  };
}
