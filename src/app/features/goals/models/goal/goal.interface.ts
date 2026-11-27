/**
 * Type GoalHealth
 *
 * @description
 * How a goal's progress compares with the elapsed quarter, as task-service computes it: `achieved`
 * at 100 %, `on-track` when it trails by at most 5 points, `at-risk` by at most 20 and `behind`
 * beyond.
 *
 * @type {'achieved' | 'on-track' | 'at-risk' | 'behind'}
 */
export type GoalHealth = 'achieved' | 'on-track' | 'at-risk' | 'behind';

/**
 * Interface KeyResultCommon
 *
 * @description
 * What every key result carries, whatever its kind.
 */
interface KeyResultCommon {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the key result within its goal.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property label
   *
   * @description
   * What the key result measures (`Customer demos held`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property progressPercent
   *
   * @description
   * Its progress, from 0 to 100, before display rounding.
   *
   * @type {number}
   * @readonly
   */
  readonly progressPercent: number;
  // #endregion
}

/**
 * Interface NumberKeyResult
 *
 * @description
 * A key result measured by a number moving from a start towards a target, up or down.
 */
export interface NumberKeyResult extends KeyResultCommon {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminant of the kind.
   *
   * @type {'number'}
   * @readonly
   */
  readonly kind: 'number';

  /**
   * Property startValue
   *
   * @description
   * Value at the start of the quarter.
   *
   * @type {number}
   * @readonly
   */
  readonly startValue: number;

  /**
   * Property currentValue
   *
   * @description
   * Value reached so far.
   *
   * @type {number}
   * @readonly
   */
  readonly currentValue: number;

  /**
   * Property targetValue
   *
   * @description
   * Value aimed at; lower than the start for a decreasing target.
   *
   * @type {number}
   * @readonly
   */
  readonly targetValue: number;
  // #endregion
}

/**
 * Interface CheckboxKeyResult
 *
 * @description
 * A key result that is either done or not.
 */
export interface CheckboxKeyResult extends KeyResultCommon {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminant of the kind.
   *
   * @type {'checkbox'}
   * @readonly
   */
  readonly kind: 'checkbox';

  /**
   * Property checked
   *
   * @description
   * Whether it is done.
   *
   * @type {boolean}
   * @readonly
   */
  readonly checked: boolean;
  // #endregion
}

/**
 * Interface ListProgressKeyResult
 *
 * @description
 * A key result computed from the done tasks of a list, cancelled tasks excluded.
 */
export interface ListProgressKeyResult extends KeyResultCommon {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminant of the kind.
   *
   * @type {'list-progress'}
   * @readonly
   */
  readonly kind: 'list-progress';

  /**
   * Property listId
   *
   * @description
   * The list it is computed from; it opens at `/:org/l/:listId`.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property eligibleTaskCount
   *
   * @description
   * Live tasks of the list that are not cancelled.
   *
   * @type {number}
   * @readonly
   */
  readonly eligibleTaskCount: number;

  /**
   * Property doneTaskCount
   *
   * @description
   * Those of them that are done.
   *
   * @type {number}
   * @readonly
   */
  readonly doneTaskCount: number;
  // #endregion
}

/**
 * Interface MilestoneKeyResult
 *
 * @description
 * A key result reached when its milestone task is done.
 */
export interface MilestoneKeyResult extends KeyResultCommon {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminant of the kind.
   *
   * @type {'milestone'}
   * @readonly
   */
  readonly kind: 'milestone';

  /**
   * Property taskKey
   *
   * @description
   * Key of the milestone task (`CAD-580`).
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property reached
   *
   * @description
   * Whether the milestone task is done.
   *
   * @type {boolean}
   * @readonly
   */
  readonly reached: boolean;
  // #endregion
}

/**
 * Type KeyResult
 *
 * @description
 * A key result the caller can read, of one of the four kinds of the contract.
 *
 * @type {NumberKeyResult | CheckboxKeyResult | ListProgressKeyResult | MilestoneKeyResult}
 */
export type KeyResult =
  NumberKeyResult | CheckboxKeyResult | ListProgressKeyResult | MilestoneKeyResult;

/**
 * Interface Goal
 *
 * @description
 * A goal of a quarter with the key results the caller can read.
 */
export interface Goal {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Goal identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * What the goal aims at (`Launch SSO for enterprises`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property ownerUserId
   *
   * @description
   * Account of the person in charge.
   *
   * @type {string}
   * @readonly
   */
  readonly ownerUserId: string;

  /**
   * Property dueDate
   *
   * @description
   * Deadline, a plain `YYYY-MM-DD` date inside the quarter.
   *
   * @type {string}
   * @readonly
   */
  readonly dueDate: string;

  /**
   * Property spaceId
   *
   * @description
   * The space that owns the goal, or null for a goal of the whole organization.
   *
   * @type {string | null}
   * @readonly
   */
  readonly spaceId: string | null;

  /**
   * Property version
   *
   * @description
   * Version of the goal and its results, sent back as `If-Match` with a change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property progressPercent
   *
   * @description
   * Average progress of its readable key results, from 0 to 100, before display rounding.
   *
   * @type {number}
   * @readonly
   */
  readonly progressPercent: number;

  /**
   * Property health
   *
   * @description
   * Its health, or null for a value a later contract adds.
   *
   * @type {GoalHealth | null}
   * @readonly
   */
  readonly health: GoalHealth | null;

  /**
   * Property results
   *
   * @description
   * Its key results, in the gateway's order; a kind a later contract adds is left out.
   *
   * @type {readonly KeyResult[]}
   * @readonly
   */
  readonly results: readonly KeyResult[];
  // #endregion
}

/**
 * Interface Quarter
 *
 * @description
 * A calendar quarter.
 */
export interface Quarter {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The contract's form, `YYYY-QN` (`2026-Q4`).
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property year
   *
   * @description
   * Calendar year.
   *
   * @type {number}
   * @readonly
   */
  readonly year: number;

  /**
   * Property number
   *
   * @description
   * Quarter of the year, from 1 to 4.
   *
   * @type {1 | 2 | 3 | 4}
   * @readonly
   */
  readonly number: 1 | 2 | 3 | 4;

  /**
   * Property end
   *
   * @description
   * Its last day, `YYYY-MM-DD`: the due date of a new goal.
   *
   * @type {string}
   * @readonly
   */
  readonly end: string;
  // #endregion
}

/**
 * Interface GoalList
 *
 * @description
 * Every goal of a quarter the caller can read, as one read returned them.
 */
export interface GoalList {
  // #region Properties
  /**
   * Property quarter
   *
   * @description
   * The quarter read.
   *
   * @type {Quarter}
   * @readonly
   */
  readonly quarter: Quarter;

  /**
   * Property goals
   *
   * @description
   * The goals, the most recently created first.
   *
   * @type {readonly Goal[]}
   * @readonly
   */
  readonly goals: readonly Goal[];

  /**
   * Property expectedProgressPercent
   *
   * @description
   * Share of the quarter elapsed on the caller's day, from 0 to 100, before display rounding.
   *
   * @type {number}
   * @readonly
   */
  readonly expectedProgressPercent: number;
  // #endregion
}

/**
 * Interface KeyResultDraft
 *
 * @description
 * A number key result to create, from 0 towards its target, as both forms submit it.
 */
export interface KeyResultDraft {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * Its label, trimmed.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property target
   *
   * @description
   * Its target, a positive whole number.
   *
   * @type {number}
   * @readonly
   */
  readonly target: number;
  // #endregion
}

/**
 * Interface GoalDraft
 *
 * @description
 * A goal to create, as the goal form submits it.
 */
export interface GoalDraft {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Its name, trimmed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property ownerUserId
   *
   * @description
   * Account of the person in charge.
   *
   * @type {string}
   * @readonly
   */
  readonly ownerUserId: string;

  /**
   * Property spaceId
   *
   * @description
   * The space it belongs to, or null for a goal of the whole organization.
   *
   * @type {string | null}
   * @readonly
   */
  readonly spaceId: string | null;

  /**
   * Property firstResult
   *
   * @description
   * Its first key result, or null.
   *
   * @type {KeyResultDraft | null}
   * @readonly
   */
  readonly firstResult: KeyResultDraft | null;
  // #endregion
}

/**
 * Interface MilestoneTask
 *
 * @description
 * What a milestone key result shows of its task, read apart from the goal (gap G-G1).
 */
export interface MilestoneTask {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Task key (`CAD-580`).
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property dueDate
   *
   * @description
   * Its due date, `YYYY-MM-DD`, or null without one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly dueDate: string | null;
  // #endregion
}

/**
 * Type MilestoneState
 *
 * @description
 * What is known of a milestone's task: the task, `missing` when the gateway answered `404`, or
 * `unknown` while it is read or after another failure.
 *
 * @type {MilestoneTask | 'missing' | 'unknown'}
 */
export type MilestoneState = MilestoneTask | 'missing' | 'unknown';

/**
 * Interface GoalSpaceOption
 *
 * @description
 * A space a member may create a goal in (gap G-G3).
 */
export interface GoalSpaceOption {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Space identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Space name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;
  // #endregion
}

/**
 * Interface GoalView
 *
 * @description
 * A goal as the page shows it: the last read with the confirmed writes no later read reflects yet
 * and the edits on their way to the gateway, its owner's name and whether the caller may change it.
 */
export interface GoalView {
  // #region Properties
  /**
   * Property goal
   *
   * @description
   * The goal; its key results show the values being sent, without those being removed.
   *
   * @type {Goal}
   * @readonly
   */
  readonly goal: Goal;

  /**
   * Property ownerName
   *
   * @description
   * Name of the person in charge, or null while the members are read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly ownerName: string | null;

  /**
   * Property canWrite
   *
   * @description
   * Whether the caller may change it: an owner or administrator for a goal of the organization,
   * `edit` on its space for a space goal (gap G-G3). The gateway still refuses what the role does
   * not allow.
   *
   * @type {boolean}
   * @readonly
   */
  readonly canWrite: boolean;
  // #endregion
}

/**
 * Interface GoalStats
 *
 * @description
 * The figures of the statistics strip, computed from the goals shown (`App.dc.html` lines
 * 5168-5175).
 */
export interface GoalStats {
  // #region Properties
  /**
   * Property count
   *
   * @description
   * Goals of the quarter.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;

  /**
   * Property averagePercent
   *
   * @description
   * Rounded average progress of the goals, 0 without any.
   *
   * @type {number}
   * @readonly
   */
  readonly averagePercent: number;

  /**
   * Property expectedPercent
   *
   * @description
   * Rounded share of the quarter elapsed.
   *
   * @type {number}
   * @readonly
   */
  readonly expectedPercent: number;

  /**
   * Property onTrack
   *
   * @description
   * Goals on track or achieved.
   *
   * @type {number}
   * @readonly
   */
  readonly onTrack: number;

  /**
   * Property achieved
   *
   * @description
   * Goals achieved.
   *
   * @type {number}
   * @readonly
   */
  readonly achieved: number;

  /**
   * Property atRisk
   *
   * @description
   * Goals at risk or behind.
   *
   * @type {number}
   * @readonly
   */
  readonly atRisk: number;
  // #endregion
}
