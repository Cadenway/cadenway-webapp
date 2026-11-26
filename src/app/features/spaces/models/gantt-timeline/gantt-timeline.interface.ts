import type {
  CwMilestone,
  CwTimelineGroup,
  CwTimelineItem,
  CwTimelineScale,
} from '@cadenway/ui/components/timeline';

import type { ListTaskItem } from '../list-tasks/list-tasks.interface';

/**
 * Type GanttGrouping
 *
 * @description
 * What the Gantt's group rows follow: the view's `groupBy`, or `all` for one `All tasks` group.
 *
 * @type {'status' | 'priority' | 'assignee' | 'all'}
 */
export type GanttGrouping = 'status' | 'priority' | 'assignee' | 'all';

/**
 * Interface GanttGroupOption
 *
 * @description
 * A group the Gantt can show, in the order it shows them.
 */
export interface GanttGroupOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The grouped value: a status key, a priority, a member id, `none` for `Unassigned` or `all`.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property label
   *
   * @description
   * The group header's name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Interface GanttParent
 *
 * @description
 * A task drawn with subtasks in the read, under it.
 */
export interface GanttParent {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether its subtasks show.
   *
   * @type {boolean}
   * @readonly
   */
  readonly open: boolean;

  /**
   * Property count
   *
   * @description
   * How many subtasks of it the read holds.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;
  // #endregion
}

/**
 * Interface GanttTimeline
 *
 * @description
 * What `cw-timeline` draws for the tasks of the view, and the task behind each of its items.
 */
export interface GanttTimeline {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * One bar per task and group (a task assigned to two members shows in both groups), in the
   * read's order; an undated task offers `Schedule`.
   *
   * @type {readonly CwTimelineItem[]}
   * @readonly
   */
  readonly items: readonly CwTimelineItem[];

  /**
   * Property groups
   *
   * @description
   * The group rows that hold tasks, in the order of the group options.
   *
   * @type {readonly CwTimelineGroup[]}
   * @readonly
   */
  readonly groups: readonly CwTimelineGroup[];

  /**
   * Property milestones
   *
   * @description
   * The dated milestones, drawn as full-height lines.
   *
   * @type {readonly CwMilestone[]}
   * @readonly
   */
  readonly milestones: readonly CwMilestone[];

  /**
   * Property tasks
   *
   * @description
   * The task shown by each item, by item id.
   *
   * @type {ReadonlyMap<string, ListTaskItem>}
   * @readonly
   */
  readonly tasks: ReadonlyMap<string, ListTaskItem>;

  /**
   * Property depths
   *
   * @description
   * How deep each item sits under its parents, by item id: 0 for a task whose parent is not shown
   * above it, up to `GANTT_SUBTASK_DEPTH`; always 0 when subtasks show apart.
   *
   * @type {ReadonlyMap<string, number>}
   * @readonly
   */
  readonly depths: ReadonlyMap<string, number>;

  /**
   * Property parents
   *
   * @description
   * The items whose task has subtasks in the read, by item id, when subtasks show under their
   * parent: their chevron.
   *
   * @type {ReadonlyMap<string, GanttParent>}
   * @readonly
   */
  readonly parents: ReadonlyMap<string, GanttParent>;

  /**
   * Property datedCount
   *
   * @description
   * Tasks with a due date, each counted once, for `Fit`.
   *
   * @type {number}
   * @readonly
   */
  readonly datedCount: number;
  // #endregion
}

/**
 * Interface GanttZoomStep
 *
 * @description
 * One step of the zoom ladder: a scale and the width factor of its columns.
 */
export interface GanttZoomStep {
  // #region Properties
  /**
   * Property scale
   *
   * @description
   * The column unit.
   *
   * @type {CwTimelineScale}
   * @readonly
   */
  readonly scale: CwTimelineScale;

  /**
   * Property zoom
   *
   * @description
   * The width factor of the columns (1 for the base width).
   *
   * @type {number}
   * @readonly
   */
  readonly zoom: number;
  // #endregion
}
