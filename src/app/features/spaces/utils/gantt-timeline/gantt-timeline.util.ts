import type { StatusKey } from '@cadenway/contracts';
import type {
  CwMilestone,
  CwTimelineGroup,
  CwTimelineItem,
  CwTimelineRange,
  CwTimelineScale,
} from '@cadenway/ui/components/timeline';

import type { TaskSummary } from '@features/task';

import type {
  GanttGroupOption,
  GanttGrouping,
  GanttParent,
  GanttTimeline,
  GanttZoomStep,
} from '../../models/gantt-timeline/gantt-timeline.interface';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import { toLocalDate } from '../calendar-date/calendar-date.util';
import { NO_ASSIGNEE_GROUP } from '../list-rows/list-rows.util';

/**
 * Constant GANTT_ZOOM_LADDER
 *
 * @description
 * The zoom steps of the Gantt, from the widest period to the narrowest (`App.dc.html` line
 * 6427), the ones `cw-timeline` follows for Ctrl + wheel and Ctrl +/−.
 *
 * @type {readonly GanttZoomStep[]}
 */
export const GANTT_ZOOM_LADDER: readonly GanttZoomStep[] = [
  { scale: 'month', zoom: 1 },
  { scale: 'month', zoom: 1.6 },
  { scale: 'week', zoom: 1 },
  { scale: 'week', zoom: 1.5 },
  { scale: 'day', zoom: 1 },
  { scale: 'day', zoom: 1.5 },
  { scale: 'day', zoom: 2 },
  { scale: 'day', zoom: 3 },
];

/**
 * Constant GANTT_SCHEDULE_DAYS
 *
 * @description
 * Days `Schedule` gives an undated task, its first day included (`App.dc.html` line 6564).
 *
 * @type {number}
 */
export const GANTT_SCHEDULE_DAYS: number = 3;

/**
 * Function addDays
 *
 * @description
 * A local day moved by a number of days.
 *
 * @param {Date} date - The day.
 * @param {number} days - Days to add, negative to go back.
 * @returns {Date} The moved day, at midnight.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Function addMonths
 *
 * @description
 * A local day moved by a number of months, its day of month held within the target month.
 *
 * @param {Date} date - The day.
 * @param {number} months - Months to add, negative to go back.
 * @returns {Date} The moved day, at midnight.
 */
export function addMonths(date: Date, months: number): Date {
  const target: Date = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const days: number = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), days));
}

/**
 * Function daysBetween
 *
 * @description
 * Days from one local day to another, whatever the daylight saving changes between them.
 *
 * @param {Date} from - The first day.
 * @param {Date} to - The second day.
 * @returns {number} The days, negative when `to` comes first.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000,
  );
}

/**
 * Function ganttWindow
 *
 * @description
 * The period `cw-timeline` shows around a day for a scale when no range is set: three weeks from
 * the Monday of the day's week, twelve weeks from two weeks before it, or six months from the
 * month before it.
 *
 * @param {CwTimelineScale} scale - The scale.
 * @param {Date} anchor - The day.
 * @returns {CwTimelineRange} The period, both days included.
 */
export function ganttWindow(scale: CwTimelineScale, anchor: Date): CwTimelineRange {
  const monday: Date = addDays(anchor, -((anchor.getDay() + 6) % 7));
  switch (scale) {
    case 'day':
      return { start: monday, end: addDays(monday, 20) };
    case 'week': {
      const start: Date = addDays(monday, -14);
      return { start, end: addDays(start, 83) };
    }
    case 'month': {
      const start: Date = addMonths(new Date(anchor.getFullYear(), anchor.getMonth(), 1), -1);
      return { start, end: addDays(addMonths(start, 6), -1) };
    }
  }
}

/**
 * Function shiftMonths
 *
 * @description
 * A day moved by whole months that keeps a month end at the month end (31 August, three months
 * on, is 30 November, and back again 31 August); any other day keeps its day of month, held
 * within the target month.
 *
 * @param {Date} date - The day.
 * @param {number} months - Months to add, negative to go back.
 * @returns {Date} The moved day, at midnight.
 */
function shiftMonths(date: Date, months: number): Date {
  const monthEnd: boolean = addDays(date, 1).getDate() === 1;
  if (!monthEnd) return addMonths(date, months);
  return new Date(date.getFullYear(), date.getMonth() + months + 1, 0);
}

/**
 * Function shiftGanttWindow
 *
 * @description
 * The period before or after one, as `cw-timeline`'s Page Up and Page Down move it: a week by
 * day, four weeks by week, three months by month (a month end stays a month end).
 *
 * @param {CwTimelineRange} range - The period shown.
 * @param {CwTimelineScale} scale - The scale.
 * @param {number} steps - Periods to move, negative to go back.
 * @returns {CwTimelineRange} The moved period.
 */
export function shiftGanttWindow(
  range: CwTimelineRange,
  scale: CwTimelineScale,
  steps: number,
): CwTimelineRange {
  if (scale === 'month') {
    return {
      start: shiftMonths(range.start, 3 * steps),
      end: shiftMonths(range.end, 3 * steps),
    };
  }
  const days: number = (scale === 'week' ? 28 : 7) * steps;
  return { start: addDays(range.start, days), end: addDays(range.end, days) };
}

/**
 * Function zoomIndexOf
 *
 * @description
 * The step of the zoom ladder a scale and zoom stand on: the exact step, else the scale's first.
 *
 * @param {CwTimelineScale} scale - The scale.
 * @param {number} zoom - The width factor.
 * @returns {number} The index in `GANTT_ZOOM_LADDER`.
 */
export function zoomIndexOf(scale: CwTimelineScale, zoom: number): number {
  const exact: number = GANTT_ZOOM_LADDER.findIndex(
    (step: GanttZoomStep): boolean => step.scale === scale && step.zoom === zoom,
  );
  return exact >= 0
    ? exact
    : GANTT_ZOOM_LADDER.findIndex((step: GanttZoomStep): boolean => step.scale === scale);
}

/**
 * Function taskProgress
 *
 * @description
 * The share of a task done, which fills its bar (`App.dc.html` line 6479): all of it once done,
 * none once cancelled, else the closed share of its subtasks, then of its checklist, else 80 % in
 * review, 40 % in progress and none otherwise. The contract has no progress field.
 *
 * @param {TaskSummary} task - The task.
 * @param {StatusKey} status - The status it shows.
 * @returns {number} The share, 0 to 100.
 */
export function taskProgress(task: TaskSummary, status: StatusKey): number {
  if (status === 'done') return 100;
  if (status === 'cancelled') return 0;
  if (task.subtasks.total > 0)
    return Math.round((100 * task.subtasks.closed) / task.subtasks.total);
  if (task.checklist.total > 0) {
    return Math.round((100 * task.checklist.closed) / task.checklist.total);
  }
  if (status === 'review') return 80;
  return status === 'progress' ? 40 : 0;
}

/**
 * Function datesOf
 *
 * @description
 * The days of a task's bar: from its start (when set and not after its due date) to its due date;
 * a milestone holds its due date only. A task without a due date has no bar, as in the mockup.
 *
 * @param {TaskSummary} task - The task.
 * @returns {{ start: Date; end: Date } | null} The days, null when undated.
 */
function datesOf(task: TaskSummary): { start: Date; end: Date } | null {
  if (task.due === null) return null;
  const end: Date = toLocalDate(task.due);
  if (task.milestone || task.start === null || task.start > task.due) return { start: end, end };
  return { start: toLocalDate(task.start), end };
}

/**
 * Function groupValuesOf
 *
 * @description
 * The groups a task shows in: its status, its priority, each of its assignees (`none` without
 * one) or the single `all` group.
 *
 * @param {ListTaskItem} item - The task as shown.
 * @param {GanttGrouping} grouping - What the groups follow.
 * @returns {readonly string[]} The group values.
 */
function groupValuesOf(item: ListTaskItem, grouping: GanttGrouping): readonly string[] {
  switch (grouping) {
    case 'status':
      return [item.status];
    case 'priority':
      return [item.task.priority];
    case 'assignee':
      return item.task.assigneeIds.length > 0 ? item.task.assigneeIds : [NO_ASSIGNEE_GROUP];
    case 'all':
      return ['all'];
  }
}

/**
 * Constant GANTT_SUBTASK_DEPTH
 *
 * @description
 * The deepest indent of a subtask under its parent, as in the `List` view; a deeper subtask
 * keeps this indent.
 *
 * @type {number}
 */
export const GANTT_SUBTASK_DEPTH: number = 2;

/**
 * Interface NestedOrder
 *
 * @description
 * The tasks to draw in order, with the depth of each and the parents shown.
 */
interface NestedOrder {
  // #region Properties
  /**
   * Property ordered
   *
   * @description
   * The tasks to draw, each shown subtask right after its parent.
   *
   * @type {readonly ListTaskItem[]}
   * @readonly
   */
  readonly ordered: readonly ListTaskItem[];

  /**
   * Property depths
   *
   * @description
   * The depth of each task drawn, by task key.
   *
   * @type {ReadonlyMap<string, number>}
   * @readonly
   */
  readonly depths: ReadonlyMap<string, number>;

  /**
   * Property parents
   *
   * @description
   * Each drawn task with subtasks in the read, by task key: whether they show and how many.
   *
   * @type {ReadonlyMap<string, GanttParent>}
   * @readonly
   */
  readonly parents: ReadonlyMap<string, GanttParent>;
  // #endregion
}

/**
 * Function nestedOrderOf
 *
 * @description
 * The tasks of the read with each subtask right after its parent, then its own subtasks, each
 * list in the read's order, and the depth of each task (0 for a task whose parent is not read).
 * The subtasks of a folded parent are left out, with theirs. Without nesting (`subtasksOpen`
 * null), the read's order with every depth at 0 and no parent.
 *
 * @param {readonly ListTaskItem[]} items - The tasks as shown, in the read's order.
 * @param {((taskKey: string) => boolean) | null} subtasksOpen - Whether a parent's subtasks show,
 * or null when subtasks show apart.
 * @returns {NestedOrder} The order, the depths and the parents.
 */
function nestedOrderOf(
  items: readonly ListTaskItem[],
  subtasksOpen: ((taskKey: string) => boolean) | null,
): NestedOrder {
  const depths: Map<string, number> = new Map<string, number>();
  const parents: Map<string, GanttParent> = new Map<string, GanttParent>();
  if (subtasksOpen === null) {
    for (const item of items) depths.set(item.task.key, 0);
    return { ordered: items, depths, parents };
  }
  const keys: Set<string> = new Set<string>(items.map((item: ListTaskItem) => item.task.key));
  const children: Map<string, ListTaskItem[]> = new Map<string, ListTaskItem[]>();
  const roots: ListTaskItem[] = [];
  for (const item of items) {
    const parent: string | null = item.task.parentKey;
    if (parent !== null && parent !== item.task.key && keys.has(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), item]);
    } else {
      roots.push(item);
    }
  }
  const ordered: ListTaskItem[] = [];
  const seen: Set<string> = new Set<string>();
  const visit: (item: ListTaskItem, depth: number, shown: boolean) => void = (
    item: ListTaskItem,
    depth: number,
    shown: boolean,
  ): void => {
    const key: string = item.task.key;
    if (seen.has(key)) return;
    seen.add(key);
    const kids: readonly ListTaskItem[] = children.get(key) ?? [];
    const open: boolean = kids.length > 0 && subtasksOpen(key);
    if (shown) {
      depths.set(key, Math.min(depth, GANTT_SUBTASK_DEPTH));
      ordered.push(item);
      if (kids.length > 0) parents.set(key, { open, count: kids.length });
    }
    for (const child of kids) visit(child, depth + 1, shown && open);
  };
  for (const root of roots) visit(root, 0, true);
  for (const item of items) visit(item, 0, true);
  return { ordered, depths, parents };
}

/**
 * Function ganttTimelineOf
 *
 * @description
 * What the Gantt draws for the tasks of the view: one item per task and group (an item's id is
 * the task key, followed by `|` and the member when grouping by assignee, since a task assigned
 * to two members shows twice). Within each group, in the read's order, or with each subtask right
 * after its parent when nesting and the subtasks of a folded parent left out: a subtask nests
 * under its parent only when both are in the group, else it is a top-level row of its own group,
 * which no fold of another group hides. Also the depth of each item under its parents and the
 * parents drawn; the groups that hold tasks, in the order of the options and then in the order
 * met; and the dated milestones drawn, as lines.
 *
 * @param {readonly ListTaskItem[]} items - The tasks as shown.
 * @param {GanttGrouping} grouping - What the groups follow.
 * @param {readonly GanttGroupOption[]} options - The known groups, in order.
 * @param {(value: string) => string} fallbackLabel - The name of a group the options lack.
 * @param {((taskKey: string) => boolean) | null} [subtasksOpen] - Whether a parent's subtasks
 * show under it, indented; null (the default) when subtasks show apart, as tasks.
 * @returns {GanttTimeline} The timeline.
 */
export function ganttTimelineOf(
  items: readonly ListTaskItem[],
  grouping: GanttGrouping,
  options: readonly GanttGroupOption[],
  fallbackLabel: (value: string) => string,
  subtasksOpen: ((taskKey: string) => boolean) | null = null,
): GanttTimeline {
  const members: Map<string, ListTaskItem[]> = new Map<string, ListTaskItem[]>();
  const met: string[] = [];
  for (const item of items) {
    for (const group of new Set<string>(groupValuesOf(item, grouping))) {
      const list: ListTaskItem[] | undefined = members.get(group);
      if (list) {
        list.push(item);
      } else {
        members.set(group, [item]);
        met.push(group);
      }
    }
  }
  const parents: Map<string, GanttParent> = new Map<string, GanttParent>();
  const depths: Map<string, number> = new Map<string, number>();
  const timelineItems: CwTimelineItem[] = [];
  const tasks: Map<string, ListTaskItem> = new Map<string, ListTaskItem>();
  const used: Set<string> = new Set<string>();
  const milestones: CwMilestone[] = [];
  const dated: Set<string> = new Set<string>();
  for (const group of met) {
    const order: NestedOrder = nestedOrderOf(members.get(group) ?? [], subtasksOpen);
    for (const item of order.ordered) {
      const task: TaskSummary = item.task;
      const id: string = grouping === 'assignee' ? `${task.key}|${group}` : task.key;
      if (tasks.has(id)) continue;
      const dates: { start: Date; end: Date } | null = datesOf(task);
      if (dates && !dated.has(task.key)) {
        dated.add(task.key);
        if (task.milestone) milestones.push({ id: task.key, label: task.name, date: dates.end });
      }
      tasks.set(id, item);
      depths.set(id, order.depths.get(task.key) ?? 0);
      const parent: GanttParent | undefined = order.parents.get(task.key);
      if (parent) parents.set(id, parent);
      used.add(group);
      timelineItems.push({
        id,
        name: task.name,
        start: dates?.start ?? null,
        end: dates?.end ?? null,
        progress: taskProgress(task, item.status),
        status: item.status,
        group,
      });
    }
  }
  const known: Set<string> = new Set<string>(options.map((option) => option.value));
  const groups: CwTimelineGroup[] = [
    ...options
      .filter((option: GanttGroupOption): boolean => used.has(option.value))
      .map((option: GanttGroupOption): CwTimelineGroup => ({
        id: option.value,
        label: option.label,
      })),
    ...met
      .filter((value: string): boolean => !known.has(value))
      .map((value: string): CwTimelineGroup => ({ id: value, label: fallbackLabel(value) })),
  ];
  return {
    items: timelineItems,
    groups,
    milestones,
    tasks,
    depths,
    parents,
    datedCount: dated.size,
  };
}
