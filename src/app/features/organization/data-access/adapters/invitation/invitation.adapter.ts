import type {
  Invitation,
  InvitationBatchResult,
  InvitationPage,
  InvitationResult,
} from '@cadenway/api-client';

import type {
  InvitationList,
  InvitationOutcome,
  PendingInvitation,
} from '../../../models/invitation/invitation.interface';
import type { AssignableMemberRole } from '../../../models/member/member.interface';

/**
 * Function toAssignableRole
 *
 * @description
 * Narrows the role of an invitation; a later role reads as `member`.
 *
 * @param {string} role - Role as the API sends it.
 * @returns {AssignableMemberRole} The role of the invitation.
 */
function toAssignableRole(role: string): AssignableMemberRole {
  return role === 'admin' || role === 'guest' ? role : 'member';
}

/**
 * Function toPendingInvitation
 *
 * @description
 * Keeps what `Pending invitations` shows of an invitation. Only `expired` reads as expired; a
 * later status counts as pending, as the list holds no other.
 *
 * @param {Invitation} invitation - `GET /v1/invitations` item.
 * @returns {PendingInvitation} Display model of the invitation.
 */
export function toPendingInvitation(invitation: Invitation): PendingInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: toAssignableRole(invitation.role),
    invitedBy: invitation.invitedBy.name,
    expired: invitation.status === 'expired',
    expiresAt: invitation.expiresAt,
  };
}

/**
 * Function toInvitationList
 *
 * @description
 * Maps a page of pending invitations with their total.
 *
 * @param {InvitationPage} page - `GET /v1/invitations` answer.
 * @returns {InvitationList} Display model of the list.
 */
export function toInvitationList(page: InvitationPage): InvitationList {
  return { items: page.items.map(toPendingInvitation), total: page.total };
}

/**
 * Function toInvitationOutcome
 *
 * @description
 * Counts the addresses of a batch that were invited; every other outcome, an unknown one
 * included, counts as skipped, as the contract asks.
 *
 * @param {InvitationBatchResult} result - `POST /v1/invitations` answer.
 * @returns {InvitationOutcome} How many were invited and skipped.
 */
export function toInvitationOutcome(result: InvitationBatchResult): InvitationOutcome {
  const invited: number = result.invitations.filter(
    (entry: InvitationResult): boolean => entry.outcome === 'invited',
  ).length;
  return { invited, skipped: result.invitations.length - invited };
}
