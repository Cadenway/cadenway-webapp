import type { WorkspaceRole } from '@features/workspace/ports/workspace-context';

/**
 * Type OrganizationSectionPath
 *
 * @description
 * Path segment of an organization settings section below `/<slug>/organization`.
 *
 * @type {'general' | 'members' | 'billing' | 'quotas' | 'security' | 'integrations' | 'audit-log'}
 */
export type OrganizationSectionPath =
  'general' | 'members' | 'billing' | 'quotas' | 'security' | 'integrations' | 'audit-log';

/**
 * Interface OrganizationSection
 *
 * @description
 * An item of the organization settings navigation (mockup `Organisation.dc.html` lines
 * 1617-1623) and the least role that may open it.
 */
export interface OrganizationSection {
  // #region Properties
  /**
   * Property path
   *
   * @description
   * Segment below `/<slug>/organization`.
   *
   * @type {OrganizationSectionPath}
   * @readonly
   */
  readonly path: OrganizationSectionPath;

  /**
   * Property least
   *
   * @description
   * Least role in the organization that may open the section.
   *
   * @type {WorkspaceRole}
   * @readonly
   */
  readonly least: WorkspaceRole;

  /**
   * Property label
   *
   * @description
   * Localized label of the item.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property icon
   *
   * @description
   * Phosphor icon of the item, Bold weight.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property activeIcon
   *
   * @description
   * Phosphor icon of the current item, Fill weight.
   *
   * @type {string}
   * @readonly
   */
  readonly activeIcon: string;
  // #endregion
}
