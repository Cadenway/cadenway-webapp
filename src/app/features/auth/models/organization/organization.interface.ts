/**
 * Type OrganizationRole
 *
 * @description
 * Role of the caller in an organization.
 *
 * @type {'owner' | 'admin' | 'member' | 'guest'}
 */
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'guest';

/**
 * Type TeamSize
 *
 * @description
 * Team size choices of the creation form, as the contract names them.
 *
 * @type {'1-5' | '6-20' | '21-100' | 'over-100'}
 */
export type TeamSize = '1-5' | '6-20' | '21-100' | 'over-100';

/**
 * Type PrimaryUse
 *
 * @description
 * Main use choices of the creation form, as the contract names them.
 *
 * @type {'product-engineering' | 'agency-client-projects' | 'marketing-content' | 'operations-support' | 'other'}
 */
export type PrimaryUse =
  | 'product-engineering'
  | 'agency-client-projects'
  | 'marketing-content'
  | 'operations-support'
  | 'other';

/**
 * Interface OrganizationChoice
 *
 * @description
 * One organization of the caller on the chooser.
 */
export interface OrganizationChoice {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Organization identifier the session switches to.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Organization name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property slug
   *
   * @description
   * Organization address, the first segment of its workspace URL.
   *
   * @type {string}
   * @readonly
   */
  readonly slug: string;

  /**
   * Property role
   *
   * @description
   * Role of the caller.
   *
   * @type {OrganizationRole}
   * @readonly
   */
  readonly role: OrganizationRole;

  /**
   * Property memberCount
   *
   * @description
   * Members taking a seat.
   *
   * @type {number}
   * @readonly
   */
  readonly memberCount: number;

  /**
   * Property plan
   *
   * @description
   * Plan key (`free`, `team`, `enterprise`...).
   *
   * @type {string}
   * @readonly
   */
  readonly plan: string;
  // #endregion
}

/**
 * Interface ReceivedInvitation
 *
 * @description
 * A pending invitation addressed to the caller.
 */
export interface ReceivedInvitation {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Invitation identifier, the one of the e-mail link.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property organizationName
   *
   * @description
   * Name of the inviting organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationName: string;

  /**
   * Property role
   *
   * @description
   * Role the invitation gives.
   *
   * @type {OrganizationRole}
   * @readonly
   */
  readonly role: OrganizationRole;

  /**
   * Property inviterName
   *
   * @description
   * Person who sent the invitation.
   *
   * @type {string}
   * @readonly
   */
  readonly inviterName: string;

  /**
   * Property expiresAt
   *
   * @description
   * ISO instant the invitation stops working.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}

/**
 * Interface OrganizationDraft
 *
 * @description
 * Submitted values of the creation form. The logo is uploaded once the organization exists.
 */
export interface OrganizationDraft {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Trimmed organization name; the address is derived from it.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property teamSize
   *
   * @description
   * Selected team size.
   *
   * @type {TeamSize}
   * @readonly
   */
  readonly teamSize: TeamSize;

  /**
   * Property primaryUse
   *
   * @description
   * Selected main use.
   *
   * @type {PrimaryUse}
   * @readonly
   */
  readonly primaryUse: PrimaryUse;

  /**
   * Property inviteEmails
   *
   * @description
   * Distinct addresses to invite as members.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly inviteEmails: readonly string[];

  /**
   * Property logo
   *
   * @description
   * PNG or SVG logo to upload after the creation, or null.
   *
   * @type {File | null}
   * @readonly
   */
  readonly logo: File | null;
  // #endregion
}
