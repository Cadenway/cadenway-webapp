/**
 * Type TaskGitProvider
 *
 * @description
 * Git host of a linked repository. A link of an unknown host (a later contract version) is left
 * out, as the contract asks.
 *
 * @type {'github' | 'gitlab'}
 */
export type TaskGitProvider = 'github' | 'gitlab';

/**
 * Type TaskGitLinkKind
 *
 * @description
 * What the task is linked to: a branch, or a GitHub pull request or GitLab merge request.
 *
 * @type {'branch' | 'pull-request'}
 */
export type TaskGitLinkKind = 'branch' | 'pull-request';

/**
 * Type TaskGitLinkState
 *
 * @description
 * What the row shows of the link's lifecycle: `branch` for a branch; `draft` for an open request
 * marked as a draft; otherwise `open`, `merged` or `closed`.
 *
 * @type {'branch' | 'draft' | 'open' | 'merged' | 'closed'}
 */
export type TaskGitLinkState = 'branch' | 'draft' | 'open' | 'merged' | 'closed';

/**
 * Type TaskGitChecksState
 *
 * @description
 * Aggregate outcome of a request's checks.
 *
 * @type {'passed' | 'failed' | 'running'}
 */
export type TaskGitChecksState = 'passed' | 'failed' | 'running';

/**
 * Type TaskGitLinkSource
 *
 * @description
 * Where the task key was found when the link was detected.
 *
 * @type {'branch' | 'title' | 'description' | 'commit'}
 */
export type TaskGitLinkSource = 'branch' | 'title' | 'description' | 'commit';

/**
 * Interface TaskGitChecks
 *
 * @description
 * The checks of a request's current head.
 */
export interface TaskGitChecks {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * Their aggregate outcome.
   *
   * @type {TaskGitChecksState}
   * @readonly
   */
  readonly state: TaskGitChecksState;

  /**
   * Property total
   *
   * @description
   * Number of check suites (GitHub) or jobs (GitLab), or null when the provider did not send it.
   *
   * @type {number | null}
   * @readonly
   */
  readonly total: number | null;

  /**
   * Property failed
   *
   * @description
   * Number of those that failed, or null when the provider did not send it.
   *
   * @type {number | null}
   * @readonly
   */
  readonly failed: number | null;
  // #endregion
}

/**
 * Interface TaskGitAuthor
 *
 * @description
 * The provider account that opened the request or created the branch (not a Cadenway member).
 */
export interface TaskGitAuthor {
  // #region Properties
  /**
   * Property login
   *
   * @description
   * Provider username.
   *
   * @type {string}
   * @readonly
   */
  readonly login: string;

  /**
   * Property name
   *
   * @description
   * Display name, or null when the provider did not send it (often on GitHub).
   *
   * @type {string | null}
   * @readonly
   */
  readonly name: string | null;
  // #endregion
}

/**
 * Interface TaskGitRepository
 *
 * @description
 * Repository (GitHub) or project (GitLab) of a link.
 */
export interface TaskGitRepository {
  // #region Properties
  /**
   * Property fullName
   *
   * @description
   * Owner and name (`atelier-nord/cadenway-web`).
   *
   * @type {string}
   * @readonly
   */
  readonly fullName: string;

  /**
   * Property url
   *
   * @description
   * Its web address.
   *
   * @type {string}
   * @readonly
   */
  readonly url: string;
  // #endregion
}

/**
 * Interface TaskGitLink
 *
 * @description
 * One branch or pull or merge request linked to the task, as the Development panel shows it.
 * The members integration-service records from the provider's webhook are null until it has.
 */
export interface TaskGitLink {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the link.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property provider
   *
   * @description
   * Git host.
   *
   * @type {TaskGitProvider}
   * @readonly
   */
  readonly provider: TaskGitProvider;

  /**
   * Property kind
   *
   * @description
   * Branch or request.
   *
   * @type {TaskGitLinkKind}
   * @readonly
   */
  readonly kind: TaskGitLinkKind;

  /**
   * Property state
   *
   * @description
   * Lifecycle shown, the draft flag folded in.
   *
   * @type {TaskGitLinkState}
   * @readonly
   */
  readonly state: TaskGitLinkState;

  /**
   * Property title
   *
   * @description
   * Title of a request, or null for a branch or a request whose title is not recorded yet.
   *
   * @type {string | null}
   * @readonly
   */
  readonly title: string | null;

  /**
   * Property number
   *
   * @description
   * Pull request number or merge request IID, or null for a branch.
   *
   * @type {number | null}
   * @readonly
   */
  readonly number: number | null;

  /**
   * Property url
   *
   * @description
   * Web address of the request or branch on the provider, or null until recorded.
   *
   * @type {string | null}
   * @readonly
   */
  readonly url: string | null;

  /**
   * Property repository
   *
   * @description
   * Its repository, or null until recorded.
   *
   * @type {TaskGitRepository | null}
   * @readonly
   */
  readonly repository: TaskGitRepository | null;

  /**
   * Property branch
   *
   * @description
   * Name of a linked branch, or the source branch of a request; null when unknown.
   *
   * @type {string | null}
   * @readonly
   */
  readonly branch: string | null;

  /**
   * Property author
   *
   * @description
   * Who opened the request or created the branch, or null until recorded.
   *
   * @type {TaskGitAuthor | null}
   * @readonly
   */
  readonly author: TaskGitAuthor | null;

  /**
   * Property checks
   *
   * @description
   * Checks of a request's head, or null when none is recorded (always for a branch).
   *
   * @type {TaskGitChecks | null}
   * @readonly
   */
  readonly checks: TaskGitChecks | null;

  /**
   * Property checksCompletedAt
   *
   * @description
   * When the latest check suite or pipeline of the head completed (ISO 8601), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly checksCompletedAt: string | null;

  /**
   * Property reviewRequested
   *
   * @description
   * Whether reviewers are requested on the request (false for a branch or when unknown).
   *
   * @type {boolean}
   * @readonly
   */
  readonly reviewRequested: boolean;

  /**
   * Property additions
   *
   * @description
   * Lines added by the request, or null when unknown (GitLab sends no line counts).
   *
   * @type {number | null}
   * @readonly
   */
  readonly additions: number | null;

  /**
   * Property deletions
   *
   * @description
   * Lines deleted by the request, or null when unknown.
   *
   * @type {number | null}
   * @readonly
   */
  readonly deletions: number | null;

  /**
   * Property linkSource
   *
   * @description
   * Where the task key was found, or null when not recorded or of a later contract version.
   *
   * @type {TaskGitLinkSource | null}
   * @readonly
   */
  readonly linkSource: TaskGitLinkSource | null;

  /**
   * Property createdAt
   *
   * @description
   * When the link was recorded (ISO 8601).
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;
  // #endregion
}

/**
 * Interface TaskGitLinkPage
 *
 * @description
 * One page of a task's Git links, newest first.
 */
export interface TaskGitLinkPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The links of the page, those of an unknown host or kind left out.
   *
   * @type {readonly TaskGitLink[]}
   * @readonly
   */
  readonly items: readonly TaskGitLink[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, or null on the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}
