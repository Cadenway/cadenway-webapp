import type { PriorityKey, StatusKey } from '@cadenway/contracts';

/**
 * Type TaskApprovalDecisionKey
 *
 * @description
 * A reviewer's recorded vote, or null while they have not voted. An unknown decision of a later
 * contract version reads as null (waiting).
 *
 * @type {'approved' | 'changes-requested' | null}
 */
export type TaskApprovalDecisionKey = 'approved' | 'changes-requested' | null;

/**
 * Type TaskApprovalRoundStatus
 *
 * @description
 * Outcome of the current round: a change request wins over approvals, approval needs every
 * eligible reviewer; an unknown status of a later contract version reads as pending.
 *
 * @type {'pending' | 'approved' | 'changes-requested'}
 */
export type TaskApprovalRoundStatus = 'pending' | 'approved' | 'changes-requested';

/**
 * Interface TaskApprovalReview
 *
 * @description
 * One reviewer of the current approval round and their vote.
 */
export interface TaskApprovalReview {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account of the reviewer; the name comes from the member directory.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property decision
   *
   * @description
   * Their vote, or null while waiting.
   *
   * @type {TaskApprovalDecisionKey}
   * @readonly
   */
  readonly decision: TaskApprovalDecisionKey;
  // #endregion
}

/**
 * Interface TaskApprovalRound
 *
 * @description
 * The current approval round of a task (`App.dc.html` lines 2122-2134).
 */
export interface TaskApprovalRound {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the round, the path of a vote.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property requesterId
   *
   * @description
   * Account that asked for the approval.
   *
   * @type {string}
   * @readonly
   */
  readonly requesterId: string;

  /**
   * Property requestedAt
   *
   * @description
   * When the round was opened (ISO 8601).
   *
   * @type {string}
   * @readonly
   */
  readonly requestedAt: string;

  /**
   * Property status
   *
   * @description
   * Outcome of the round.
   *
   * @type {TaskApprovalRoundStatus}
   * @readonly
   */
  readonly status: TaskApprovalRoundStatus;

  /**
   * Property reviews
   *
   * @description
   * The eligible reviewers in request order.
   *
   * @type {readonly TaskApprovalReview[]}
   * @readonly
   */
  readonly reviews: readonly TaskApprovalReview[];
  // #endregion
}

/**
 * Interface TaskApprovalSnapshot
 *
 * @description
 * The approval of a task at one of its versions: the round (null without one, or for a
 * milestone) and the task's version and status the answer was made at.
 */
export interface TaskApprovalSnapshot {
  // #region Properties
  /**
   * Property round
   *
   * @description
   * The current round, or null.
   *
   * @type {TaskApprovalRound | null}
   * @readonly
   */
  readonly round: TaskApprovalRound | null;

  /**
   * Property taskVersion
   *
   * @description
   * Version of the task the answer was made at, its `If-Match` precondition.
   *
   * @type {number}
   * @readonly
   */
  readonly taskVersion: number;

  /**
   * Property taskStatus
   *
   * @description
   * Status of the task at that version (a vote may have moved it).
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly taskStatus: StatusKey;
  // #endregion
}

/**
 * Interface TaskAttachment
 *
 * @description
 * A ready file attached to a task (`App.dc.html` lines 2169-2191).
 */
export interface TaskAttachment {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the attachment.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * File name, extension included.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property contentType
   *
   * @description
   * Media type of the file.
   *
   * @type {string}
   * @readonly
   */
  readonly contentType: string;

  /**
   * Property size
   *
   * @description
   * Size in bytes.
   *
   * @type {number}
   * @readonly
   */
  readonly size: number;

  /**
   * Property authorId
   *
   * @description
   * Account that attached it, or null for a public intake submission.
   *
   * @type {string | null}
   * @readonly
   */
  readonly authorId: string | null;

  /**
   * Property uploadedAt
   *
   * @description
   * When it was attached (ISO 8601).
   *
   * @type {string}
   * @readonly
   */
  readonly uploadedAt: string;

  /**
   * Property version
   *
   * @description
   * Version of the attachment, the `If-Match` of its deletion.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Type TaskActivityActorType
 *
 * @description
 * Who made a change: `user` (a person), `automation` (a rule), `git` (the Git integration),
 * `system` (a service), or a type of a later contract version, shown by its identifier.
 *
 * @type {string}
 */
export type TaskActivityActorType = string;

/**
 * Interface TaskActivityActor
 *
 * @description
 * The author of an activity entry or a comment.
 */
export interface TaskActivityActor {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Kind of author.
   *
   * @type {TaskActivityActorType}
   * @readonly
   */
  readonly type: TaskActivityActorType;

  /**
   * Property id
   *
   * @description
   * The account for a person, the service name for `system`, the rule for an automation.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property provider
   *
   * @description
   * Verified Git provider (`github`, `gitlab`) of a Git entry, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly provider: string | null;
  // #endregion
}

/**
 * Type TaskActivityChange
 *
 * @description
 * What an activity entry records: the creation, a status, priority or due date change, an
 * assignment, a comment, or a kind a later contract version adds (shown as a generic change).
 *
 * @type {{ kind: 'create' } | { kind: 'status'; from: StatusKey; to: StatusKey } | { kind: 'priority'; from: PriorityKey; to: PriorityKey } | { kind: 'due'; from: string | null; to: string | null } | { kind: 'assign'; userId: string; added: boolean } | { kind: 'comment'; excerpt: string } | { kind: 'other' }}
 */
export type TaskActivityChange =
  | { readonly kind: 'create' }
  | { readonly kind: 'status'; readonly from: StatusKey; readonly to: StatusKey }
  | { readonly kind: 'priority'; readonly from: PriorityKey; readonly to: PriorityKey }
  | { readonly kind: 'due'; readonly from: string | null; readonly to: string | null }
  | { readonly kind: 'assign'; readonly userId: string; readonly added: boolean }
  | { readonly kind: 'comment'; readonly excerpt: string }
  | { readonly kind: 'other' };

/**
 * Interface TaskActivityEntry
 *
 * @description
 * One entry of the activity log of a task (`App.dc.html` lines 2326-2335).
 */
export interface TaskActivityEntry {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the entry.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property at
   *
   * @description
   * When the change was made (ISO 8601).
   *
   * @type {string}
   * @readonly
   */
  readonly at: string;

  /**
   * Property actor
   *
   * @description
   * Who made it.
   *
   * @type {TaskActivityActor}
   * @readonly
   */
  readonly actor: TaskActivityActor;

  /**
   * Property change
   *
   * @description
   * What changed.
   *
   * @type {TaskActivityChange}
   * @readonly
   */
  readonly change: TaskActivityChange;
  // #endregion
}

/**
 * Interface TaskActivityPage
 *
 * @description
 * One page of the activity log, the most recent first.
 */
export interface TaskActivityPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The entries of the page.
   *
   * @type {readonly TaskActivityEntry[]}
   * @readonly
   */
  readonly items: readonly TaskActivityEntry[];

  /**
   * Property total
   *
   * @description
   * Entries of the whole log.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

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

/**
 * Interface TaskMentionSpan
 *
 * @description
 * A mention of a Markdown text, by account: code-point offsets of its `@[Name](id)` token,
 * start inclusive and end exclusive, as the comment and description contracts take them.
 */
export interface TaskMentionSpan {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Mentioned account.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property start
   *
   * @description
   * Offset of the token's `@`, in Unicode code points.
   *
   * @type {number}
   * @readonly
   */
  readonly start: number;

  /**
   * Property end
   *
   * @description
   * Offset just after the token, in Unicode code points.
   *
   * @type {number}
   * @readonly
   */
  readonly end: number;
  // #endregion
}

/**
 * Interface TaskAddRequest
 *
 * @description
 * A text typed in an add field (a subtask, a checklist item) and how its write settled: the field
 * keeps the text until `settle(true)`, so a refused write leaves it to correct or send again.
 */
export interface TaskAddRequest {
  // #region Properties
  /**
   * Property text
   *
   * @description
   * The typed text, trimmed and not blank.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property settle
   *
   * @description
   * Reports whether the write was saved; the field is emptied only then, and only while it still
   * holds the sent text.
   *
   * @type {(saved: boolean) => void}
   * @readonly
   */
  readonly settle: (saved: boolean) => void;
  // #endregion
}
