/**
 * Type MemberRole
 *
 * @description
 * Role of a person in the organization: `owner` (`Owner`), `admin` (`Administrator`), `member`
 * (`Member`) or `guest` (`Guest`).
 *
 * @type {'owner' | 'admin' | 'member' | 'guest'}
 */
export type MemberRole = 'owner' | 'admin' | 'member' | 'guest';

/**
 * Type AssignableMemberRole
 *
 * @description
 * A role an owner or an administrator may give: nobody becomes the owner.
 *
 * @type {Exclude<MemberRole, 'owner'>}
 */
export type AssignableMemberRole = Exclude<MemberRole, 'owner'>;

/**
 * Type MemberPresence
 *
 * @description
 * What the others see of a member's presence: an absent or invisible member is `offline`.
 *
 * @type {'online' | 'away' | 'do-not-disturb' | 'offline'}
 */
export type MemberPresence = 'online' | 'away' | 'do-not-disturb' | 'offline';

/**
 * Type MemberRoleFilter
 *
 * @description
 * The `Filter by role` tab: `all`, `admin` (the owner and the administrators), `member` or `guest`.
 *
 * @type {'all' | 'admin' | 'member' | 'guest'}
 */
export type MemberRoleFilter = 'all' | 'admin' | 'member' | 'guest';

/**
 * Type MemberPresenceFilter
 *
 * @description
 * The `Filter by presence` tab: `all`, `online` (online, away or do not disturb) or `offline`.
 *
 * @type {'all' | 'online' | 'offline'}
 */
export type MemberPresenceFilter = 'all' | 'online' | 'offline';

/**
 * Interface OrganizationMember
 *
 * @description
 * A membership of the current organization, as the members table shows it.
 */
export interface OrganizationMember {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the membership, the `memberId` of the member routes and of the presence map.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property userId
   *
   * @description
   * Id of the account; the person's own row is marked `(you)` with it.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Full name of the account; the avatar derives the initials from it.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Email address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property role
   *
   * @description
   * Role in the organization.
   *
   * @type {MemberRole}
   * @readonly
   */
  readonly role: MemberRole;

  /**
   * Property twoStepVerification
   *
   * @description
   * Whether the account has two-step verification (`Two-step`); null when the caller may not
   * know it (a member reads no such column).
   *
   * @type {boolean | null}
   * @readonly
   */
  readonly twoStepVerification: boolean | null;

  /**
   * Property version
   *
   * @description
   * Version of the membership.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface MemberRoleCounts
 *
 * @description
 * Members of the organization by role, whatever the filters, for the role tabs and the summary.
 */
export interface MemberRoleCounts {
  // #region Properties
  /**
   * Property owner
   *
   * @description
   * The owner (one).
   *
   * @type {number}
   * @readonly
   */
  readonly owner: number;

  /**
   * Property admin
   *
   * @description
   * Administrators.
   *
   * @type {number}
   * @readonly
   */
  readonly admin: number;

  /**
   * Property member
   *
   * @description
   * Members.
   *
   * @type {number}
   * @readonly
   */
  readonly member: number;

  /**
   * Property guest
   *
   * @description
   * Guests.
   *
   * @type {number}
   * @readonly
   */
  readonly guest: number;
  // #endregion
}

/**
 * Interface MemberPage
 *
 * @description
 * One read of the members: the rows, those matching the search and the roles on every page, the
 * counts by role and the cursor of the next page.
 */
export interface MemberPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Members of the page, sorted by name; every matching member for a presence filter.
   *
   * @type {readonly OrganizationMember[]}
   * @readonly
   */
  readonly items: readonly OrganizationMember[];

  /**
   * Property total
   *
   * @description
   * Members that match the search and the roles, on every page.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property counts
   *
   * @description
   * Members by role, whatever the filters.
   *
   * @type {MemberRoleCounts}
   * @readonly
   */
  readonly counts: MemberRoleCounts;

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page; null on the last page and for a complete read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;

  /**
   * Property truncated
   *
   * @description
   * Whether a complete read stopped at its member limit before the last page; false for a page.
   *
   * @type {boolean}
   * @readonly
   */
  readonly truncated: boolean;
  // #endregion
}

/**
 * Interface MemberQuery
 *
 * @description
 * What the members read asks for: the search and the roles the filters keep.
 */
export interface MemberQuery {
  // #region Properties
  /**
   * Property search
   *
   * @description
   * Text to find in the name or the address; empty for none.
   *
   * @type {string}
   * @readonly
   */
  readonly search: string;

  /**
   * Property roles
   *
   * @description
   * Roles to keep; empty for every role.
   *
   * @type {readonly MemberRole[]}
   * @readonly
   */
  readonly roles: readonly MemberRole[];
  // #endregion
}

/**
 * Interface MemberRow
 *
 * @description
 * A row of the members table: the member with its pending role, its live presence and whether it
 * is the person's own row.
 */
export interface MemberRow extends OrganizationMember {
  // #region Properties
  /**
   * Property presence
   *
   * @description
   * Live presence from the realtime connection; `offline` when unknown.
   *
   * @type {MemberPresence}
   * @readonly
   */
  readonly presence: MemberPresence;

  /**
   * Property me
   *
   * @description
   * Whether the row is the signed-in person's.
   *
   * @type {boolean}
   * @readonly
   */
  readonly me: boolean;

  /**
   * Property pending
   *
   * @description
   * Whether a role change or a removal of the member is being sent.
   *
   * @type {boolean}
   * @readonly
   */
  readonly pending: boolean;
  // #endregion
}
