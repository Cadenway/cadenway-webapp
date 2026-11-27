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
 * What became of a batch of addresses: how many were invited and how many were skipped, being
 * already a member, already invited or an outcome this version does not know.
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
   * Addresses for which nothing was sent.
   *
   * @type {number}
   * @readonly
   */
  readonly skipped: number;
  // #endregion
}
