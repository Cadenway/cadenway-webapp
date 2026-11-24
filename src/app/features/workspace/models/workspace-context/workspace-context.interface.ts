/**
 * Type WorkspaceRole
 *
 * @description
 * Role of the signed-in person in the current organization, from the most to the least
 * privileged: `owner`, `admin`, `member`, `guest`.
 *
 * @type {'owner' | 'admin' | 'member' | 'guest'}
 */
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

/**
 * Interface WorkspaceUser
 *
 * @description
 * The signed-in person as the workspace screens display them.
 */
export interface WorkspaceUser {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Account identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Full name (« Camille Martin »).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property firstName
   *
   * @description
   * First word of the full name, used by the greeting (« Camille »).
   *
   * @type {string}
   * @readonly
   */
  readonly firstName: string;

  /**
   * Property displayName
   *
   * @description
   * Name used for mentions, or null until the person chooses one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly displayName: string | null;

  /**
   * Property email
   *
   * @description
   * Verified account address.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property initials
   *
   * @description
   * One or two uppercase letters derived from the full name (« CM »).
   *
   * @type {string}
   * @readonly
   */
  readonly initials: string;
  // #endregion
}

/**
 * Interface WorkspaceOrganization
 *
 * @description
 * The organization a workspace URL names, with the person's role and the organization's plan.
 */
export interface WorkspaceOrganization {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Organization identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property slug
   *
   * @description
   * First path segment of every workspace URL (`/atelier-nord`).
   *
   * @type {string}
   * @readonly
   */
  readonly slug: string;

  /**
   * Property name
   *
   * @description
   * Organization name (« Atelier Nord »).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property initials
   *
   * @description
   * One or two uppercase letters derived from the name (« AN »).
   *
   * @type {string}
   * @readonly
   */
  readonly initials: string;

  /**
   * Property role
   *
   * @description
   * Role of the signed-in person in this organization.
   *
   * @type {WorkspaceRole}
   * @readonly
   */
  readonly role: WorkspaceRole;

  /**
   * Property plan
   *
   * @description
   * Plan key as Billing reports it (`free`, `team`, `enterprise`, or a later key).
   *
   * @type {string}
   * @readonly
   */
  readonly plan: string;
  // #endregion
}

/**
 * Interface WorkspaceContext
 *
 * @description
 * The person and the organization a workspace route runs for.
 */
export interface WorkspaceContext {
  // #region Properties
  /**
   * Property user
   *
   * @description
   * The signed-in person.
   *
   * @type {WorkspaceUser}
   * @readonly
   */
  readonly user: WorkspaceUser;

  /**
   * Property organization
   *
   * @description
   * The organization named by the URL, which is the session's current organization.
   *
   * @type {WorkspaceOrganization}
   * @readonly
   */
  readonly organization: WorkspaceOrganization;
  // #endregion
}

/**
 * Interface WorkspaceProblem
 *
 * @description
 * What the gateway answered when a workspace read or switch failed.
 */
export interface WorkspaceProblem {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * HTTP status, zero for a network failure.
   *
   * @type {number}
   * @readonly
   */
  readonly status: number;

  /**
   * Property code
   *
   * @description
   * Gateway problem code (`organization.not-selected`), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly code: string | null;
  // #endregion
}

/**
 * Type WorkspaceResult
 *
 * @description
 * A workspace read or switch that succeeded with a value, or failed with the gateway's problem.
 *
 * @template T - Display model of a success.
 * @type {{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: WorkspaceProblem }}
 */
export type WorkspaceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: WorkspaceProblem };
