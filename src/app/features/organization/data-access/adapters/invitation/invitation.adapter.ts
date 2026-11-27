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
 * Constant SKIPPED_OUTCOMES
 *
 * @description
 * Per-address outcomes for which nothing was sent because nothing is left to send: the address is
 * a member (`already-member`) or has a pending invitation (`already-invited`).
 *
 * @type {ReadonlySet<string>}
 */
const SKIPPED_OUTCOMES: ReadonlySet<string> = new Set<string>([
  'already-member',
  'already-invited',
]);

/**
 * Function toInvitationOutcome
 *
 * @description
 * Counts the addresses of a batch that were invited and those skipped, being already a member or
 * invited. Any other outcome, one a later contract adds included, counts as not sent, as the
 * contract asks: those addresses are listed in `notSent`, so they can be sent again.
 *
 * @param {InvitationBatchResult} result - `POST /v1/invitations` answer.
 * @returns {InvitationOutcome} How many were invited and skipped, and the addresses not sent.
 */
export function toInvitationOutcome(result: InvitationBatchResult): InvitationOutcome {
  let invited: number = 0;
  let skipped: number = 0;
  const notSent: string[] = [];
  for (const entry of result.invitations as readonly InvitationResult[]) {
    if (entry.outcome === 'invited') invited += 1;
    else if (SKIPPED_OUTCOMES.has(entry.outcome)) skipped += 1;
    else notSent.push(entry.email);
  }
  return { invited, skipped, notSent };
}
