import type { WorkspaceOrganization } from '../workspace-context/workspace-context.interface';

/**
 * Interface OrganizationMenuEntry
 *
 * @description
 * An organization of the caller as the organizations menu lists it: the workspace display model
 * and its member count (`Members and invitations 18`).
 */
export interface OrganizationMenuEntry extends WorkspaceOrganization {
  // #region Properties
  /**
   * Property memberCount
   *
   * @description
   * Active members of the organization.
   *
   * @type {number}
   * @readonly
   */
  readonly memberCount: number;
  // #endregion
}
