import type { Signal } from '@angular/core';

import type {
  WorkspaceOrganization,
  WorkspaceRole,
  WorkspaceUser,
} from '../../models/workspace-context/workspace-context.interface';

/**
 * Interface WorkspaceContextPort
 *
 * @description
 * What layouts and other features may read of the workspace a `/:org` route runs for. The values
 * are set before any component of the route is created and follow an organization switch in
 * place, so a reader never sees an empty context.
 */
export interface WorkspaceContextPort {
  // #region Properties
  /**
   * Property user
   *
   * @description
   * The signed-in person.
   *
   * @type {Signal<WorkspaceUser>}
   * @readonly
   */
  readonly user: Signal<WorkspaceUser>;

  /**
   * Property organization
   *
   * @description
   * The organization named by the URL, which is the session's current organization.
   *
   * @type {Signal<WorkspaceOrganization>}
   * @readonly
   */
  readonly organization: Signal<WorkspaceOrganization>;

  /**
   * Property role
   *
   * @description
   * Role of the person in that organization.
   *
   * @type {Signal<WorkspaceRole>}
   * @readonly
   */
  readonly role: Signal<WorkspaceRole>;
  // #endregion

  // #region Methods
  /**
   * Method can
   *
   * @description
   * Whether the person's role is at least the given one, in the order owner, admin, member,
   * guest: `can('admin')` holds for an owner or an admin. Reactive when read in a template or a
   * computed signal.
   *
   * @param {WorkspaceRole} role - Least role required.
   * @returns {boolean} Whether the current role meets it.
   */
  can(role: WorkspaceRole): boolean;
  // #endregion
}
