import type { PriorityKey, StatusKey } from '../list-view-config/list-view-config.interface';

/**
 * Interface AutomationCreatedTrigger
 *
 * @description
 * `Task created`: the rule runs when a task is created anywhere in the organization.
 */
export interface AutomationCreatedTrigger {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Kind of trigger.
   *
   * @type {'created'}
   * @readonly
   */
  readonly type: 'created';
  // #endregion
}

/**
 * Interface AutomationStatusTrigger
 *
 * @description
 * `Status becomes…`: the rule runs when a task enters a status.
 */
export interface AutomationStatusTrigger {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Kind of trigger.
   *
   * @type {'status'}
   * @readonly
   */
  readonly type: 'status';

  /**
   * Property status
   *
   * @description
   * The status the task enters.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;
  // #endregion
}

/**
 * Type AutomationTrigger
 *
 * @description
 * The task fact that makes a rule run (`When`, `App.dc.html` line 3266).
 *
 * @type {AutomationCreatedTrigger | AutomationStatusTrigger}
 */
export type AutomationTrigger = AutomationCreatedTrigger | AutomationStatusTrigger;

/**
 * Interface AutomationPersonAction
 *
 * @description
 * `Assign to` (adds the person to the assignees) or `Notify` (tells the person about the task).
 */
export interface AutomationPersonAction {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Kind of action.
   *
   * @type {'assign' | 'notify'}
   * @readonly
   */
  readonly type: 'assign' | 'notify';

  /**
   * Property userId
   *
   * @description
   * The organization member assigned or notified.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}

/**
 * Interface AutomationPriorityAction
 *
 * @description
 * `Change the priority`: sets the task's priority.
 */
export interface AutomationPriorityAction {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Kind of action.
   *
   * @type {'priority'}
   * @readonly
   */
  readonly type: 'priority';

  /**
   * Property priority
   *
   * @description
   * The priority given to the task.
   *
   * @type {PriorityKey}
   * @readonly
   */
  readonly priority: PriorityKey;
  // #endregion
}

/**
 * Interface AutomationCommentAction
 *
 * @description
 * `Add a comment`: posts a comment on the task.
 */
export interface AutomationCommentAction {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Kind of action.
   *
   * @type {'comment'}
   * @readonly
   */
  readonly type: 'comment';

  /**
   * Property body
   *
   * @description
   * Markdown of the comment, 1 to 5,000 characters, not whitespace only.
   *
   * @type {string}
   * @readonly
   */
  readonly body: string;
  // #endregion
}

/**
 * Type AutomationAction
 *
 * @description
 * What a rule does to the task that made it run (`Then`, `App.dc.html` line 3268).
 *
 * @type {AutomationPersonAction | AutomationPriorityAction | AutomationCommentAction}
 */
export type AutomationAction =
  AutomationPersonAction | AutomationPriorityAction | AutomationCommentAction;

/**
 * Type AutomationActionType
 *
 * @description
 * The four kinds of action, in the mockup's order (`AUTO_ACTIONS`, `App.dc.html` lines 3627-3632).
 *
 * @type {AutomationAction['type']}
 */
export type AutomationActionType = AutomationAction['type'];

/**
 * Interface AutomationDraft
 *
 * @description
 * A rule to create: its trigger and its action. A new rule starts enabled.
 */
export interface AutomationDraft {
  // #region Properties
  /**
   * Property trigger
   *
   * @description
   * When the rule runs.
   *
   * @type {AutomationTrigger}
   * @readonly
   */
  readonly trigger: AutomationTrigger;

  /**
   * Property action
   *
   * @description
   * What it does.
   *
   * @type {AutomationAction}
   * @readonly
   */
  readonly action: AutomationAction;
  // #endregion
}

/**
 * Interface AutomationRule
 *
 * @description
 * A "when… then…" rule of the organization, applied to every task of the workspace.
 */
export interface AutomationRule extends AutomationDraft {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the rule.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property enabled
   *
   * @description
   * Whether the rule reacts to new task events.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;

  /**
   * Property version
   *
   * @description
   * Version of the stored rule, sent as `If-Match` by its writes.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Type AutomationWriteOutcome
 *
 * @description
 * What became of a switch or a deletion:
 * - `applied`: the gateway confirmed it, or nothing had to be sent;
 * - `refused`: the gateway refused it (a definite 4xx), so the recorded state is shown again;
 * - `not-applied`: the answer was lost, and the rules read again show it did not apply;
 * - `unknown`: the answer was lost and the rules could not be read again.
 *
 * @type {'applied' | 'refused' | 'not-applied' | 'unknown'}
 */
export type AutomationWriteOutcome = 'applied' | 'refused' | 'not-applied' | 'unknown';

/**
 * Interface AutomationCommentRunAction
 *
 * @description
 * A comment a rule posted; the run does not carry the comment's text.
 */
export interface AutomationCommentRunAction {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * Kind of action.
   *
   * @type {'comment'}
   * @readonly
   */
  readonly type: 'comment';
  // #endregion
}

/**
 * Type AutomationRunAction
 *
 * @description
 * The action a run applied.
 *
 * @type {AutomationPersonAction | AutomationPriorityAction | AutomationCommentRunAction}
 */
export type AutomationRunAction =
  AutomationPersonAction | AutomationPriorityAction | AutomationCommentRunAction;

/**
 * Interface AutomationRun
 *
 * @description
 * One applied action of `Last runs` (`App.dc.html` line 3298).
 */
export interface AutomationRun {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the execution.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property ruleId
   *
   * @description
   * The rule that ran; it may have been deleted since.
   *
   * @type {string}
   * @readonly
   */
  readonly ruleId: string;

  /**
   * Property taskKey
   *
   * @description
   * Key of the task the action was applied to (`CAD-482`).
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property action
   *
   * @description
   * What was applied.
   *
   * @type {AutomationRunAction}
   * @readonly
   */
  readonly action: AutomationRunAction;

  /**
   * Property executedAt
   *
   * @description
   * ISO 8601 instant of the execution.
   *
   * @type {string}
   * @readonly
   */
  readonly executedAt: string;
  // #endregion
}
