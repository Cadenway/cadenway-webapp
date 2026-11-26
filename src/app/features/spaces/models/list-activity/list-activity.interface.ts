import type { PriorityKey, StatusKey } from '@cadenway/contracts';

/**
 * Type ListActivityKind
 *
 * @description
 * A kind of entry the `Activity` view filters by (`ACT_KINDS` of `App.dc.html`): a creation, a
 * status, priority or due date change, an assignment change or a comment.
 *
 * @type {'create' | 'status' | 'priority' | 'due' | 'assign' | 'comment'}
 */
export type ListActivityKind = 'create' | 'status' | 'priority' | 'due' | 'assign' | 'comment';

/**
 * Constant LIST_ACTIVITY_KINDS
 *
 * @description
 * The kinds of the type chips, in the mockup's order (`ACT_KINDS` of `App.dc.html` lines
 * 3797-3800).
 *
 * @type {readonly ListActivityKind[]}
 */
export const LIST_ACTIVITY_KINDS: readonly ListActivityKind[] = [
  'status',
  'assign',
  'create',
  'comment',
  'priority',
  'due',
];

/**
 * Interface ListActivityActor
 *
 * @description
 * Who made a change: a person (`user`, `id` is the account), an automation rule, the Git
 * integration or a service (`system`); a later type is kept as the gateway names it.
 */
export interface ListActivityActor {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Type of the actor: `user`, `automation`, `git`, `system` or a later one.
   *
   * @type {string}
   * @readonly
   */
  readonly type: string;

  /**
   * Property id
   *
   * @description
   * The account of a person, the id of the rule or the service otherwise.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property provider
   *
   * @description
   * Verified provider of a Git actor (`github`, `gitlab`), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly provider: string | null;
  // #endregion
}

/**
 * Type ListActivityChange
 *
 * @description
 * What an entry records; a kind without its member, or a kind this version does not know, is
 * `other` (written `changed the task`).
 *
 * @type {object}
 */
export type ListActivityChange =
  | { readonly kind: 'create' }
  | { readonly kind: 'status'; readonly from: StatusKey; readonly to: StatusKey }
  | { readonly kind: 'priority'; readonly from: PriorityKey; readonly to: PriorityKey }
  | { readonly kind: 'due'; readonly from: string | null; readonly to: string | null }
  | { readonly kind: 'assign'; readonly userId: string; readonly added: boolean }
  | { readonly kind: 'comment'; readonly excerpt: string }
  | { readonly kind: 'other' };

/**
 * Interface ListActivityTask
 *
 * @description
 * The task an entry names, with its name and status as they are now.
 */
export interface ListActivityTask {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the task (`CAD-482`).
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Name of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Current status of the task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;
  // #endregion
}

/**
 * Interface ListActivityEntry
 *
 * @description
 * One entry of the activity log of a list.
 */
export interface ListActivityEntry {
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
   * When the change was made, as an ISO 8601 instant.
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
   * @type {ListActivityActor}
   * @readonly
   */
  readonly actor: ListActivityActor;

  /**
   * Property task
   *
   * @description
   * The task it is about.
   *
   * @type {ListActivityTask}
   * @readonly
   */
  readonly task: ListActivityTask;

  /**
   * Property change
   *
   * @description
   * What it records.
   *
   * @type {ListActivityChange}
   * @readonly
   */
  readonly change: ListActivityChange;
  // #endregion
}

/**
 * Interface ListActivityPage
 *
 * @description
 * One page of the activity log, the most recent entries first.
 */
export interface ListActivityPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The entries of the page.
   *
   * @type {readonly ListActivityEntry[]}
   * @readonly
   */
  readonly items: readonly ListActivityEntry[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, null on the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;

  /**
   * Property total
   *
   * @description
   * Entries that match the filters, on every page (`18 events`).
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Interface ListActivityFilter
 *
 * @description
 * The filters of the `Activity` view: the kinds of the type chips (every kind when empty) and the
 * person (`Everyone` when null).
 */
export interface ListActivityFilter {
  // #region Properties
  /**
   * Property kinds
   *
   * @description
   * Kinds to keep, in the chips' order; every kind when empty (`All`).
   *
   * @type {readonly ListActivityKind[]}
   * @readonly
   */
  readonly kinds: readonly ListActivityKind[];

  /**
   * Property actorId
   *
   * @description
   * Account of the person to keep, null for everyone.
   *
   * @type {string | null}
   * @readonly
   */
  readonly actorId: string | null;
  // #endregion
}
