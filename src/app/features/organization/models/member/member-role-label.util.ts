import type { MemberRole } from './member.interface';

/**
 * Function memberRoleLabel
 *
 * @description
 * The name of a role as the members table, its toasts and the pending invitations show it
 * (`Organisation.dc.html` line 1597, `roleNames`).
 *
 * @param {MemberRole} role - The role.
 * @returns {string} `Owner`, `Administrator`, `Member` or `Guest`.
 */
export function memberRoleLabel(role: MemberRole): string {
  switch (role) {
    case 'owner':
      return $localize`:@@organization.members.role-owner:Owner`;
    case 'admin':
      return $localize`:@@organization.members.role-admin:Administrator`;
    case 'guest':
      return $localize`:@@organization.members.role-guest:Guest`;
    default:
      return $localize`:@@organization.members.role-member:Member`;
  }
}
