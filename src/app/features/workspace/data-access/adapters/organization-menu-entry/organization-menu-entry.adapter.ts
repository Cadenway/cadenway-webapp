import type { MyOrganization } from '@cadenway/api-client';

import type { OrganizationMenuEntry } from '../../../models/organization-menu-entry/organization-menu-entry.interface';
import { toWorkspaceOrganization } from '../workspace-context/workspace-context.adapter';

/**
 * Function toOrganizationMenuEntry
 *
 * @description
 * Keeps the fields of an organization of the caller the organizations menu displays.
 *
 * @param {MyOrganization} organization - Entry of `GET /v1/organizations`.
 * @returns {OrganizationMenuEntry} Display model of the entry.
 */
export function toOrganizationMenuEntry(organization: MyOrganization): OrganizationMenuEntry {
  return { ...toWorkspaceOrganization(organization), memberCount: organization.memberCount };
}
