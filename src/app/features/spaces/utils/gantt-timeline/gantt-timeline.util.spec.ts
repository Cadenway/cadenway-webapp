import type { StatusKey } from '@cadenway/contracts';
import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '@features/task';

import type { GanttTimeline } from '../../models/gantt-timeline/gantt-timeline.interface';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import {
  addMonths,
  ganttTimelineOf,
  ganttWindow,
  shiftGanttWindow,
  taskProgress,
  zoomIndexOf,
} from './gantt-timeline.util';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {Partial<TaskSummary>} [changes] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(key: string, changes: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name: key,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due: null,
    start: null,
    labels: [],
    subtasks: { closed: 0, total: 0 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'sprint-14',
    spaceId: 'product',
    version: 3,
    ...changes,
  };
}

/**
 * Function shown
 *
 * @description
 * A task as a view shows it, with its saved status.
 *
 * @param {TaskSummary} summary - The task.
 * @param {StatusKey} [status] - The status it shows.
 * @returns {ListTaskItem} The item.
 */
function shown(summary: TaskSummary, status: StatusKey = summary.status): ListTaskItem {
  return { task: summary, status };
}

describe('gantt-timeline util', () => {
  it('gives the periods cw-timeline shows around a day', () => {
    const thursday: Date = new Date(2026, 10, 26);

    expect(ganttWindow('day', thursday)).toEqual({
      start: new Date(2026, 10, 23),
      end: new Date(2026, 11, 13),
    });
    expect(ganttWindow('week', thursday)).toEqual({
      start: new Date(2026, 10, 9),
      end: new Date(2027, 0, 31),
    });
    expect(ganttWindow('month', thursday)).toEqual({
      start: new Date(2026, 9, 1),
      end: new Date(2027, 2, 31),
    });
  });

  it('moves a period by a week, four weeks or three months', () => {
    const shown: { start: Date; end: Date } = {
      start: new Date(2026, 10, 23),
      end: new Date(2026, 11, 13),
    };

    expect(shiftGanttWindow(shown, 'day', 1)).toEqual({
      start: new Date(2026, 10, 30),
      end: new Date(2026, 11, 20),
    });
    expect(shiftGanttWindow(shown, 'week', -1)).toEqual({
      start: new Date(2026, 9, 26),
      end: new Date(2026, 10, 15),
    });
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
  });

  it('finds the step of the zoom ladder, falling back on the first step of a scale', () => {
    expect(zoomIndexOf('month', 1)).toBe(0);
    expect(zoomIndexOf('week', 1.5)).toBe(3);
    expect(zoomIndexOf('day', 3)).toBe(7);
    expect(zoomIndexOf('day', 1.2)).toBe(4);
  });

  it('derives the progress from the status, then the subtasks and checklist', () => {
    expect(taskProgress(task('CAD-482'), 'done')).toBe(100);
    expect(taskProgress(task('CAD-482', { subtasks: { closed: 1, total: 4 } }), 'cancelled')).toBe(
      0,
    );
    expect(taskProgress(task('CAD-482', { subtasks: { closed: 1, total: 4 } }), 'progress')).toBe(
      25,
    );
    expect(taskProgress(task('CAD-482', { checklist: { closed: 2, total: 3 } }), 'todo')).toBe(67);
    expect(taskProgress(task('CAD-482'), 'review')).toBe(80);
    expect(taskProgress(task('CAD-482'), 'progress')).toBe(40);
    expect(taskProgress(task('CAD-482'), 'todo')).toBe(0);
  });

  it('draws dated bars, undated rows and milestone lines in the order of the groups', () => {
    const timeline: GanttTimeline = ganttTimelineOf(
      [
        shown(task('CAD-482', { start: '2026-11-23', due: '2026-11-27' }), 'progress'),
        shown(task('CAD-483', { due: '2026-11-25' })),
        shown(task('CAD-484', { start: '2026-11-30', due: '2026-11-27' })),
        shown(task('CAD-485')),
        shown(task('CAD-490', { milestone: true, start: '2026-11-20', due: '2026-12-04' })),
      ],
      'status',
      [
        { value: 'todo', label: 'To do' },
        { value: 'progress', label: 'In progress' },
        { value: 'done', label: 'Done' },
      ],
      (value: string): string => value,
    );

    expect(timeline.groups).toEqual([
      { id: 'todo', label: 'To do' },
      { id: 'progress', label: 'In progress' },
    ]);
    expect(timeline.items.map((item) => [item.id, item.start, item.end, item.group])).toEqual([
      ['CAD-482', new Date(2026, 10, 23), new Date(2026, 10, 27), 'progress'],
      ['CAD-483', new Date(2026, 10, 25), new Date(2026, 10, 25), 'todo'],
      ['CAD-484', new Date(2026, 10, 27), new Date(2026, 10, 27), 'todo'],
      ['CAD-485', null, null, 'todo'],
      ['CAD-490', new Date(2026, 11, 4), new Date(2026, 11, 4), 'todo'],
    ]);
    expect(timeline.items[0]).toEqual(
      expect.objectContaining({ progress: 40, status: 'progress' }),
    );
    expect(timeline.milestones).toEqual([
      { id: 'CAD-490', label: 'CAD-490', date: new Date(2026, 11, 4) },
    ]);
    expect(timeline.datedCount).toBe(4);
  });

  it('shows a task under each of its assignees and names unknown groups', () => {
    const timeline: GanttTimeline = ganttTimelineOf(
      [
        shown(task('CAD-482', { assigneeIds: ['u-ines', 'u-camille'], due: '2026-11-27' })),
        shown(task('CAD-483')),
      ],
      'assignee',
      [
        { value: 'u-camille', label: 'Camille Martin' },
        { value: 'none', label: 'Unassigned' },
      ],
      (value: string): string => `? ${value}`,
    );

    expect(timeline.items.map((item) => item.id)).toEqual([
      'CAD-482|u-ines',
      'CAD-482|u-camille',
      'CAD-483|none',
    ]);
    expect(timeline.groups).toEqual([
      { id: 'u-camille', label: 'Camille Martin' },
      { id: 'none', label: 'Unassigned' },
      { id: 'u-ines', label: '? u-ines' },
    ]);
    expect(timeline.tasks.get('CAD-482|u-camille')?.task.key).toBe('CAD-482');
    expect(timeline.datedCount).toBe(1);
  });

  it('puts each subtask right after its parent when nesting, at most two levels deep', () => {
    const items: readonly ListTaskItem[] = [
      shown(task('CAD-488', { parentKey: 'CAD-486' })),
      shown(task('CAD-482')),
      shown(task('CAD-486', { parentKey: 'CAD-482' })),
      shown(task('CAD-489', { parentKey: 'CAD-488' })),
      shown(task('CAD-490', { parentKey: 'CAD-999' })),
      shown(task('CAD-483')),
    ];

    const nested: GanttTimeline = ganttTimelineOf(items, 'all', [], String, true);
    expect(nested.items.map((item) => [item.id, nested.depths.get(item.id)])).toEqual([
      ['CAD-482', 0],
      ['CAD-486', 1],
      ['CAD-488', 2],
      ['CAD-489', 2],
      ['CAD-490', 0],
      ['CAD-483', 0],
    ]);

    const apart: GanttTimeline = ganttTimelineOf(items, 'all', [], String);
    expect(apart.items.map((item) => [item.id, apart.depths.get(item.id)])).toEqual([
      ['CAD-488', 0],
      ['CAD-482', 0],
      ['CAD-486', 0],
      ['CAD-489', 0],
      ['CAD-490', 0],
      ['CAD-483', 0],
    ]);
  });

  it('keeps every task once when subtasks point at each other', () => {
    const nested: GanttTimeline = ganttTimelineOf(
      [
        shown(task('CAD-482', { parentKey: 'CAD-486' })),
        shown(task('CAD-486', { parentKey: 'CAD-482' })),
      ],
      'all',
      [],
      String,
      true,
    );

    expect(nested.items.map((item) => item.id)).toEqual(['CAD-482', 'CAD-486']);
  });
});
