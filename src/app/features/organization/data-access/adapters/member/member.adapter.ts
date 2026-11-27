import type { Member, MemberPage as MemberPageDto } from '@cadenway/api-client';

import type {
  MemberPage,
  MemberRole,
  OrganizationMember,
} from '../../../models/member/member.interface';

/**
 * Constant ROLES
 *
 * @description
 * Roles this version knows; a later role reads as `member`, the least role that sees the list.
 *
 * @type {ReadonlySet<string>}
 */
const ROLES: ReadonlySet<string> = new Set<string>(['owner', 'admin', 'member', 'guest']);

/**
 * Function toMemberRole
 *
 * @description
 * Narrows a role of the contract to the roles the table shows.
 *
 * @param {string} role - Role as the API sends it.
 * @returns {MemberRole} The role, `member` for an unknown one.
 */
export function toMemberRole(role: string): MemberRole {
  return ROLES.has(role) ? (role as MemberRole) : 'member';
}

/**
 * Function toOrganizationMember
 *
 * @description
 * Keeps what the members table shows of a membership. `twoStepVerificationEnabled` is absent for
 * a caller who is neither the owner nor an administrator: the model then holds null.
 *
 * @param {Member} member - `GET /v1/members` item.
 * @returns {OrganizationMember} Display model of the membership.
 */
export function toOrganizationMember(member: Member): OrganizationMember {
  return {
    id: member.id,
    userId: member.userId,
    name: member.name,
    email: member.email,
    role: toMemberRole(member.role),
    twoStepVerification: member.twoStepVerificationEnabled ?? null,
    version: member.version,
  };
}

/**
 * Function toMemberPage
 *
 * @description
 * Maps one page of members with its total and its counts by role.
 *
 * @param {MemberPageDto} page - `GET /v1/members` answer.
 * @returns {MemberPage} Display model of the page.
 */
export function toMemberPage(page: MemberPageDto): MemberPage {
  return {
    items: page.items.map(toOrganizationMember),
    total: page.total,
    counts: {
      owner: page.counts.owner,
      admin: page.counts.admin,
      member: page.counts.member,
      guest: page.counts.guest,
    },
    nextCursor: page.nextCursor ?? null,
    truncated: false,
  };
}
