import type { WorkspaceRole } from '../workspace-context/workspace-context.interface';

/**
 * Interface OrganizationRoleFallback
 *
 * @description
 * A place `organizationRoleGuard` may send a person whose role is too low for the route: the
 * first fallback whose `least` role the person meets wins.
 */
export interface OrganizationRoleFallback {
  // #region Properties
  /**
   * Property least
   *
   * @description
   * Least role the fallback route requires.
   *
   * @type {WorkspaceRole}
   * @readonly
   */
  readonly least: WorkspaceRole;

  /**
   * Property path
   *
   * @description
   * Segments below `/<slug>` (`['organization', 'general']`).
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly path: readonly string[];
  // #endregion
}
