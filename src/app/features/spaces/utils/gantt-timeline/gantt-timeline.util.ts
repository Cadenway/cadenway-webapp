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
 * Function shiftGanttWindow
 *
 * @description
 * The period before or after one, as `cw-timeline`'s Page Up and Page Down move it: a week by
 * day, four weeks by week, three months by month.
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
    return { start: addMonths(range.start, 3 * steps), end: addMonths(range.end, 3 * steps) };
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
 * Function nestedOrderOf
 *
 * @description
 * The tasks of the read with each subtask right after its parent, then its own subtasks, each
 * list in the read's order, and the depth of each task (0 for a task whose parent is not read).
 * Without nesting, the read's order with every depth at 0.
 *
 * @param {readonly ListTaskItem[]} items - The tasks as shown, in the read's order.
 * @param {boolean} nest - Whether subtasks follow their parent.
 * @returns {{ ordered: readonly ListTaskItem[]; depths: ReadonlyMap<string, number> }} The order
 * and the depth of each task key.
 */
function nestedOrderOf(
  items: readonly ListTaskItem[],
  nest: boolean,
): { ordered: readonly ListTaskItem[]; depths: ReadonlyMap<string, number> } {
  const depths: Map<string, number> = new Map<string, number>();
  if (!nest) {
    for (const item of items) depths.set(item.task.key, 0);
    return { ordered: items, depths };
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
  const visit: (item: ListTaskItem, depth: number) => void = (
    item: ListTaskItem,
    depth: number,
  ): void => {
    if (depths.has(item.task.key)) return;
    depths.set(item.task.key, Math.min(depth, GANTT_SUBTASK_DEPTH));
    ordered.push(item);
    for (const child of children.get(item.task.key) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  for (const item of items) visit(item, 0);
  return { ordered, depths };
}

/**
 * Function ganttTimelineOf
 *
 * @description
 * What the Gantt draws for the tasks of the view: one item per task and group, in the read's
 * order, or with each subtask right after its parent when nesting (an item's id is the task key,
 * followed by `|` and the member when grouping by assignee, since a task assigned to two members
 * shows twice); the depth of each item under its parents; the groups that hold tasks, in the
 * order of the options and then in the order met; and the dated milestones as lines.
 *
 * @param {readonly ListTaskItem[]} items - The tasks as shown.
 * @param {GanttGrouping} grouping - What the groups follow.
 * @param {readonly GanttGroupOption[]} options - The known groups, in order.
 * @param {(value: string) => string} fallbackLabel - The name of a group the options lack.
 * @param {boolean} [nest] - Whether subtasks follow their parent, indented.
 * @returns {GanttTimeline} The timeline.
 */
export function ganttTimelineOf(
  items: readonly ListTaskItem[],
  grouping: GanttGrouping,
  options: readonly GanttGroupOption[],
  fallbackLabel: (value: string) => string,
  nest: boolean = false,
): GanttTimeline {
  const order: { ordered: readonly ListTaskItem[]; depths: ReadonlyMap<string, number> } =
    nestedOrderOf(items, nest);
  const ordered: readonly ListTaskItem[] = order.ordered;
  const taskDepths: ReadonlyMap<string, number> = order.depths;
  const depths: Map<string, number> = new Map<string, number>();
  const timelineItems: CwTimelineItem[] = [];
  const tasks: Map<string, ListTaskItem> = new Map<string, ListTaskItem>();
  const used: Set<string> = new Set<string>();
  const met: string[] = [];
  const milestones: CwMilestone[] = [];
  const dated: Set<string> = new Set<string>();
  for (const item of ordered) {
    const task: TaskSummary = item.task;
    const dates: { start: Date; end: Date } | null = datesOf(task);
    if (dates && !dated.has(task.key)) {
      dated.add(task.key);
      if (task.milestone) milestones.push({ id: task.key, label: task.name, date: dates.end });
    }
    for (const group of groupValuesOf(item, grouping)) {
      const id: string = grouping === 'assignee' ? `${task.key}|${group}` : task.key;
      if (tasks.has(id)) continue;
      tasks.set(id, item);
      depths.set(id, taskDepths.get(task.key) ?? 0);
      if (!used.has(group)) {
        used.add(group);
        met.push(group);
      }
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
  return { items: timelineItems, groups, milestones, tasks, depths, datedCount: dated.size };
}
