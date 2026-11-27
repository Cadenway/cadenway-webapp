import type { WorkspaceRole } from '../../models/workspace-context/workspace-context.interface';

/**
 * Constant ROLE_RANK
 *
 * @description
 * Position of each role, the most privileged first.
 *
 * @type {Readonly<Record<WorkspaceRole, number>>}
 */
const ROLE_RANK: Readonly<Record<WorkspaceRole, number>> = {
  owner: 0,
  admin: 1,
  member: 2,
  guest: 3,
};

/**
 * Function meetsRole
 *
 * @description
 * Whether a role is at least the required one, in the order owner, admin, member, guest:
 * `meetsRole('owner', 'admin')` holds, `meetsRole('member', 'admin')` does not.
 *
 * @param {WorkspaceRole} role - Role the person holds.
 * @param {WorkspaceRole} least - Least role required.
 * @returns {boolean} Whether `role` meets `least`.
 */
export function meetsRole(role: WorkspaceRole, least: WorkspaceRole): boolean {
  return ROLE_RANK[role] <= ROLE_RANK[least];
}
