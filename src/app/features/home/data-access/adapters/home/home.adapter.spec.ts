import type { GetHomeClientResult } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { HomeTaskDto } from '../task-summary/task-summary.adapter';
import { type ListSummaryDto, toHomeSnapshot, toHomeSprint } from './home.adapter';

/**
 * Function summary
 *
 * @description
 * A list of Atelier Nord's `Product` space with its counts, a sprint when dates are given.
 *
 * @param {string} id - The list.
 * @param {string} name - Its name.
 * @param {ListSummaryDto['list']['sprint']} sprint - Its sprint dates, or null.
 * @returns {ListSummaryDto} The list.
 */
function summary(
  id: string,
  name: string,
  sprint: ListSummaryDto['list']['sprint'] = null,
): ListSummaryDto {
  return {
    list: {
      id,
      spaceId: 'sp-product',
      name,
      icon: null,
      color: 'violet',
      sprint,
      createdAt: '2026-10-01T08:00:00Z',
      version: 1,
    },
    counts: { total: 34, open: 14, done: 12, cancelled: 2, late: 3 },
  };
}

/**
 * Constant task
 *
 * @description
 * A priority of Camille Martin in `Sprint 14`.
 *
 * @type {HomeTaskDto}
 */
const task: HomeTaskDto = {
  key: 'CAD-482',
  name: 'Review of the SSO flow',
  status: 'progress',
  cancelReason: null,
  priority: 'haute',
  assignees: [{ userId: 'u-camille' }],
  dueDate: '2026-11-12',
  startDate: null,
  estimateMinutes: null,
  labels: ['sso'],
  parentKey: null,
  listId: 'l-sprint-14',
  spaceId: 'sp-product',
  subtaskCounts: { closed: 1, total: 2 },
  checklistCounts: { done: 0, total: 3 },
  completedAt: null,
  createdAt: '2026-11-02T08:00:00Z',
  version: 4,
  milestone: true,
};

describe('home adapter', () => {
  it('maps the counters, the priorities, the first current sprint and the lists', () => {
    const home: GetHomeClientResult = {
      stats: { assigned: 9, late: 2, dueToday: 1, done: 31 },
      priorities: [task],
      sprints: [
        summary('l-sprint-14', 'Sprint 14', {
          startDate: '2026-11-03',
          endDate: '2026-11-17',
          goal: null,
        }),
        summary('l-sprint-15', 'Sprint 15', {
          startDate: '2026-11-10',
          endDate: '2026-11-24',
          goal: null,
        }),
      ],
      lists: [summary('l-backlog', 'Backlog')],
    };

    expect(toHomeSnapshot(home)).toEqual({
      stats: { assigned: 9, late: 2, dueToday: 1, done: 31 },
      priorities: [
        expect.objectContaining({
          id: 'CAD-482',
          key: 'CAD-482',
          status: 'progress',
          due: '2026-11-12',
          assigneeIds: ['u-camille'],
          checklist: { closed: 0, total: 3 },
          milestone: true,
          recurrence: 'none',
          comments: null,
          version: 4,
        }),
      ],
      sprint: {
        listId: 'l-sprint-14',
        name: 'Sprint 14',
        startDate: '2026-11-03',
        endDate: '2026-11-17',
        done: 12,
        live: 32,
      },
      lists: [{ id: 'l-backlog', name: 'Backlog', spaceId: 'sp-product', open: 14 }],
    });
  });

  it('shows no sprint card without a current sprint or sprint dates', () => {
    const home: GetHomeClientResult = {
      stats: { assigned: 0, late: 0, dueToday: 0, done: 0 },
      priorities: [],
      sprints: [],
      lists: [],
    };

    expect(toHomeSnapshot(home).sprint).toBeNull();
    expect(toHomeSprint(summary('l-backlog', 'Backlog'))).toBeNull();
  });
});
