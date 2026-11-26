/**
 * Type ShareRole
 *
 * @description
 * A role a grant gives on a list: `Can edit`, `Can comment` or `View only`.
 *
 * @type {'edit' | 'comment' | 'view'}
 */
export type ShareRole = 'edit' | 'comment' | 'view';

/**
 * Interface ShareDirectoryEntry
 *
 * @description
 * A member or guest of the organization, as the member directory names them.
 */
export interface ShareDirectoryEntry {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account identifier, the `userId` of a grant.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Full name (`Léa Petit`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Email address, which `Invite by email` matches without regard to case.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property guest
   *
   * @description
   * Whether the person is a guest of the organization (`Guest`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly guest: boolean;
  // #endregion
}

/**
 * Interface ShareGrant
 *
 * @description
 * The role one person holds on the list.
 */
export interface ShareGrant {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property role
   *
   * @description
   * Their role on the list.
   *
   * @type {ShareRole}
   * @readonly
   */
  readonly role: ShareRole;
  // #endregion
}

/**
 * Interface ListAccess
 *
 * @description
 * Who has access to a list, as the share dialog reads it when it opens.
 */
export interface ListAccess {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller has `edit` on the list, which changing its access needs.
   *
   * @type {boolean}
   * @readonly
   */
  readonly canEdit: boolean;

  /**
   * Property organizationAccess
   *
   * @description
   * Whether the `Organization access` switch is on.
   *
   * @type {boolean}
   * @readonly
   */
  readonly organizationAccess: boolean;

  /**
   * Property privateSpace
   *
   * @description
   * Whether the list's space is private, where the switch changes nothing.
   *
   * @type {boolean}
   * @readonly
   */
  readonly privateSpace: boolean;

  /**
   * Property ownerId
   *
   * @description
   * Account of the space's owner (`Owner`), who holds no grant and always has `edit`.
   *
   * @type {string}
   * @readonly
   */
  readonly ownerId: string;

  /**
   * Property grants
   *
   * @description
   * Every grant of the list, in the order access was given.
   *
   * @type {readonly ShareGrant[]}
   * @readonly
   */
  readonly grants: readonly ShareGrant[];

  /**
   * Property directory
   *
   * @description
   * Every member and guest of the organization, or null when the caller may not read the
   * directory (names unknown, no invitation by email).
   *
   * @type {readonly ShareDirectoryEntry[] | null}
   * @readonly
   */
  readonly directory: readonly ShareDirectoryEntry[] | null;
  // #endregion
}

/**
 * Interface SharePerson
 *
 * @description
 * One row of `People with access`.
 */
export interface SharePerson {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Full name, or null when the directory does not list the person.
   *
   * @type {string | null}
   * @readonly
   */
  readonly name: string | null;

  /**
   * Property email
   *
   * @description
   * Email address, or null when the directory does not list the person.
   *
   * @type {string | null}
   * @readonly
   */
  readonly email: string | null;

  /**
   * Property guest
   *
   * @description
   * Whether the person is a guest of the organization.
   *
   * @type {boolean}
   * @readonly
   */
  readonly guest: boolean;

  /**
   * Property role
   *
   * @description
   * Their role on the list, `owner` for the space's owner.
   *
   * @type {ShareRole | 'owner'}
   * @readonly
   */
  readonly role: ShareRole | 'owner';
  // #endregion
}

/**
 * Interface ShareWrite
 *
 * @description
 * What the gateway answered to a change of the list's access.
 */
export interface ShareWrite {
  // #region Properties
  /**
   * Property version
   *
   * @description
   * Version of the list after the change (its `ETag`), or null when the answer carried none.
   *
   * @type {number | null}
   * @readonly
   */
  readonly version: number | null;
  // #endregion
}

/**
 * Type ShareInviteOutcome
 *
 * @description
 * What `Invite` did with an address: `sent` (a grant was given or changed, optimistically),
 * `invalid` (no domain), `unknown` (no member or guest of the organization has it), `owner`
 * (the space's owner, who already has access) or `ignored` (empty field, or the caller may not
 * share).
 *
 * @type {'sent' | 'invalid' | 'unknown' | 'owner' | 'ignored'}
 */
export type ShareInviteOutcome = 'sent' | 'invalid' | 'unknown' | 'owner' | 'ignored';
