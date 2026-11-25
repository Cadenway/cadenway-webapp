import type { TaskSummary as TaskSummaryDto } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toTaskSummary } from '@features/task/data-access/adapters/task-summary/task-summary.adapter';

import type { ListTaskQuery } from '../../../models/list-view-config/list-view-config.interface';
import { toGroupCountParams, toListTask, toListTasksQuery, withGroup } from './list-task.adapter';

/**
 * Constant dto
 *
 * @description
 * CAD-482 as `queryListTasks` answers it.
 *
 * @type {TaskSummaryDto}
 */
const dto: TaskSummaryDto = {
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  status: 'progress',
  cancelReason: null,
  priority: 'haute',
  assignees: [{ userId: 'u-camille' }, { userId: 'u-ines' }],
  dueDate: '2026-11-12',
  startDate: null,
  estimateMinutes: null,
  labels: ['Auth', 'Front'],
  parentKey: null,
  listId: 'sprint-14',
  spaceId: 'produit',
  subtaskCounts: { total: 3, closed: 1 },
  checklistCounts: { total: 4, done: 2 },
  completedAt: null,
  createdAt: '2026-11-03T09:00:00Z',
  version: 7,
};

/**
 * Constant query
 *
 * @description
 * A filtered query of the « Liste » view.
 *
 * @type {ListTaskQuery}
 */
const query: ListTaskQuery = {
  status: ['todo', 'progress'],
  label: ['Front'],
  search: 'SSO',
  level: 'roots',
  sort: '-dueDate',
};

describe('list task adapter', () => {
  it('maps the same summary as the task feature', () => {
    expect(toListTask(dto)).toEqual(toTaskSummary(dto));
  });

  it('maps a task of a list page, its key as its id', () => {
    expect(toListTask(dto)).toEqual({
      id: 'CAD-482',
      key: 'CAD-482',
      name: 'Refondre l’écran de connexion SSO',
      status: 'progress',
      cancelReason: null,
      priority: 'haute',
      assigneeIds: ['u-camille', 'u-ines'],
      due: '2026-11-12',
      start: null,
      labels: ['Auth', 'Front'],
      subtasks: { closed: 1, total: 3 },
      checklist: { closed: 2, total: 4 },
      comments: null,
      parentKey: null,
      milestone: false,
      recurrence: 'none',
      listId: 'sprint-14',
      spaceId: 'produit',
      version: 7,
    });
  });

  it('reads a group with its value in place of the grouped filter', () => {
    expect(withGroup(query, { groupBy: 'status', value: 'progress' }).status).toEqual(['progress']);
    expect(withGroup(query, { groupBy: 'assignee', value: 'none' }).assignee).toEqual(['none']);
    expect(withGroup(query, null)).toBe(query);
  });

  it('builds the page body and the group count parameters', () => {
    expect(
      toListTasksQuery(query, { groupBy: 'priority', value: 'haute' }, 'cursor-2', 50),
    ).toEqual({
      status: ['todo', 'progress'],
      priority: ['haute'],
      label: ['Front'],
      search: 'SSO',
      level: 'roots',
      sort: '-dueDate',
      cursor: 'cursor-2',
      limit: 50,
    });
    expect(toGroupCountParams({ groupBy: 'status', query }, null)).toEqual({
      groupBy: 'status',
      status: ['todo', 'progress'],
      label: ['Front'],
      search: 'SSO',
      level: 'roots',
      limit: 100,
    });
  });
});
