import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '@features/task';

import type { GroupProgress } from '../../models/list-rows/list-rows.interface';
import { advanceGroup, groupValuesOf, nextGroup, startGroups } from './list-rows.util';

/**
 * Constant cad482
 *
 * @description
 * CAD-482 of Sprint 14, in progress, assigned to two people.
 *
 * @type {TaskSummary}
 */
const cad482: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  status: 'progress',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u-camille', 'u-ines'],
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
};

describe('list rows utils', () => {
  it('reads open groups to their end and folded groups for their header only', () => {
    let groups: GroupProgress[] = startGroups([
      { value: 'todo', count: 3 },
      { value: 'progress', count: 0 },
      { value: 'cancelled', count: 8 },
    ]);
    expect(nextGroup(groups, ['cancelled'])?.value).toBe('todo');

    groups = advanceGroup(groups, 'todo', { items: [], nextCursor: null, total: 3 });
    expect(nextGroup(groups, ['cancelled'])?.value).toBe('cancelled');

    groups = advanceGroup(groups, 'cancelled', { items: [], nextCursor: 'cursor-2', total: 8 });
    expect(nextGroup(groups, ['cancelled'])).toBeNull();
    expect(nextGroup(groups, [])).toMatchObject({ value: 'cancelled', cursor: 'cursor-2' });
  });

  it('files a task under its status, its priority or each of its assignees', () => {
    expect(groupValuesOf(cad482, 'status')).toEqual(['progress']);
    expect(groupValuesOf(cad482, 'priority')).toEqual(['haute']);
    expect(groupValuesOf(cad482, 'assignee')).toEqual(['u-camille', 'u-ines']);
    expect(groupValuesOf({ ...cad482, assigneeIds: [] }, 'assignee')).toEqual(['none']);
    expect(groupValuesOf(cad482, null)).toEqual(['all']);
  });
});
