import type { AssignableMemberRole } from '../member/member.interface';

/**
 * Interface PendingInvitation
 *
 * @description
 * An invitation neither accepted, refused nor revoked, as `Pending invitations` lists it.
 */
export interface PendingInvitation {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the invitation.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property email
   *
   * @description
   * Invited address.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property role
   *
   * @description
   * Role the invitee gets on joining.
   *
   * @type {AssignableMemberRole}
   * @readonly
   */
  readonly role: AssignableMemberRole;

  /**
   * Property invitedBy
   *
   * @description
   * Name of the person who sent it (`Invited by <name>`).
   *
   * @type {string}
   * @readonly
   */
  readonly invitedBy: string;

  /**
   * Property expired
   *
   * @description
   * Whether its 7 days are over (`Expired on <date>`); otherwise `Expires in <n> days`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly expired: boolean;

  /**
   * Property expiresAt
   *
   * @description
   * When it expires or expired, as an ISO 8601 instant.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}

/**
 * Interface InvitationList
 *
 * @description
 * The pending invitations of the organization and how many there are on every page.
 */
export interface InvitationList {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Pending invitations, the most recently sent first.
   *
   * @type {readonly PendingInvitation[]}
   * @readonly
   */
  readonly items: readonly PendingInvitation[];

  /**
   * Property total
   *
   * @description
   * Pending invitations of the organization, expired ones included.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Interface InvitationOutcome
 *
 * @description
 * What became of a batch of addresses: how many were invited, how many were skipped, being
 * already a member or already invited, and which were not sent (an outcome this version does not
 * know, which the contract counts as not sent).
 */
export interface InvitationOutcome {
  // #region Properties
  /**
   * Property invited
   *
   * @description
   * Addresses whose invitation was created and sent.
   *
   * @type {number}
   * @readonly
   */
  readonly invited: number;

  /**
   * Property skipped
   *
   * @description
   * Addresses for which nothing was sent, being already a member or already invited.
   *
   * @type {number}
   * @readonly
   */
  readonly skipped: number;

  /**
   * Property notSent
   *
   * @description
   * Addresses the batch answered with another outcome, as the API spelled them: nothing was sent
   * to them, and sending them again is the way to invite them.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly notSent: readonly string[];

  /**
   * Property unknown
   *
   * @description
   * Addresses sent that the answer gave no result or conflicting results, spelled as sent: their
   * outcome is unknown, so they are neither sent nor skipped.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly unknown: readonly string[];
  // #endregion
}

/**
 * Type InvitationStatus
 *
 * @description
 * Lifecycle state of one invitation as `getInvitation` answers it; `other` for a state this
 * version does not know (the contract's enum is extensible), which settles nothing.
 *
 * @type {'pending' | 'expired' | 'accepted' | 'refused' | 'revoked' | 'other'}
 */
export type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'refused' | 'revoked' | 'other';

/**
 * Interface InvitationStanding
 *
 * @description
 * One invitation in any state of its lifecycle, read on its own to settle a write of unknown
 * outcome. Never kept: each read is a fresh answer of the API.
 */
export interface InvitationStanding {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Where the invitation stands now.
   *
   * @type {InvitationStatus}
   * @readonly
   */
  readonly status: InvitationStatus;

  /**
   * Property invitation
   *
   * @description
   * The invitation as `Pending invitations` would list it; its `expiresAt` moves with each resend
   * (`sentAt` plus 7 days).
   *
   * @type {PendingInvitation}
   * @readonly
   */
  readonly invitation: PendingInvitation;
  // #endregion
}
