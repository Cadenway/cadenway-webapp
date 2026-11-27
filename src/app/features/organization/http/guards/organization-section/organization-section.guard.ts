import type { CanActivateFn } from '@angular/router';

import { organizationRoleGuard } from '@features/workspace/http/guards/organization-role';

import {
  ORGANIZATION_SECTION_FALLBACKS,
  ORGANIZATION_SECTIONS,
} from '../../../constants/organization-sections/organization-sections.constants';
import type {
  OrganizationSection,
  OrganizationSectionPath,
} from '../../../models/organization-section/organization-section.interface';

/**
 * Function organizationSectionGuard
 *
 * @description
 * The `canActivate` guard of an organization settings section: Workspace's
 * `organizationRoleGuard` with the section's least role from `ORGANIZATION_SECTIONS`, sending a
 * person refused it to the first section their role may open, or to `/<slug>` for a guest.
 *
 * @param {OrganizationSectionPath} path - The guarded section.
 * @returns {CanActivateFn} The guard.
 * @throws {Error} When the section is not in `ORGANIZATION_SECTIONS`.
 */
export function organizationSectionGuard(path: OrganizationSectionPath): CanActivateFn {
  const section: OrganizationSection | undefined = ORGANIZATION_SECTIONS.find(
    (candidate: OrganizationSection) => candidate.path === path,
  );
  if (section === undefined) throw new Error(`Unknown organization section ${path}.`);
  return organizationRoleGuard(section.least, ORGANIZATION_SECTION_FALLBACKS);
}
