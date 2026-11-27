import type { ArchivedList, ArchivedTask } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toArchivedListItem, toArchivedTaskItem } from './archives.adapter';

/**
 * Constant sprint13
 *
 * @description
 * The contract's example of an archived list: `Sprint 13`, archived by a person.
 *
 * @type {ArchivedList}
 */
const sprint13: ArchivedList = {
  list: {
    id: 'l-sprint13',
    spaceId: 'sp-product',
    name: 'Sprint 13',
    icon: 'lightning',
    color: 'violet',
    sprint: { startDate: '2026-10-20', endDate: '2026-11-02', goal: null },
    createdAt: '2026-10-16T10:00:00Z',
    version: 4,
    archivedAt: '2026-11-03T09:00:00Z',
    archivedBy: { type: 'user', id: 'u-camille' },
    callerRole: 'edit',
  },
  taskCount: 14,
};

/**
 * Constant cad430
 *
 * @description
 * The contract's example of an archived task: `CAD-430` of `Sprint 14`.
 *
 * @type {ArchivedTask}
 */
const cad430: ArchivedTask = {
  task: {
    key: 'CAD-430',
    name: 'Old pricing page',
    status: 'done',
    cancelReason: null,
    priority: 'basse',
    assignees: [{ userId: 'u-hugo' }],
    dueDate: null,
    startDate: null,
    estimateMinutes: 120,
    labels: ['Front'],
    parentKey: null,
    listId: 'l-sprint14',
    spaceId: 'sp-product',
    subtaskCounts: { total: 0, closed: 0 },
    checklistCounts: { total: 0, done: 0 },
    completedAt: '2026-11-04T17:10:00Z',
    createdAt: '2026-10-21T09:00:00Z',
    version: 7,
  },
  list: { id: 'l-sprint14', spaceId: 'sp-product', name: 'Sprint 14', state: 'active' },
  subtaskCount: 0,
  archivedAt: '2026-11-05T11:30:00Z',
  archivedBy: { type: 'user', id: 'u-hugo' },
};

describe('archives adapter', () => {
  it('maps an archived sprint with its space, count, date and author', () => {
    expect(toArchivedListItem(sprint13)).toEqual({
      id: 'l-sprint13',
      name: 'Sprint 13',
      spaceId: 'sp-product',
      sprint: true,
      taskCount: 14,
      archivedAt: '2026-11-03T09:00:00Z',
      archivedBy: 'u-camille',
    });
  });

  it('keeps no author for an actor that is not a person', () => {
    const list: ArchivedList = {
      ...sprint13,
      list: { ...sprint13.list, sprint: null, archivedBy: { type: 'automation', id: 'rule-1' } },
    };
    expect(toArchivedListItem(list)).toMatchObject({ sprint: false, archivedBy: null });
  });

  it('maps an archived task with its live list', () => {
    expect(toArchivedTaskItem(cad430)).toEqual({
      key: 'CAD-430',
      name: 'Old pricing page',
      status: 'done',
      milestone: false,
      listName: 'Sprint 14',
      listArchived: false,
      archivedAt: '2026-11-05T11:30:00Z',
      archivedBy: 'u-hugo',
    });
  });

  it('marks the list of a task archived only for the archived state', () => {
    const archived: ArchivedTask = { ...cad430, list: { ...cad430.list, state: 'archived' } };
    const deleted: ArchivedTask = { ...cad430, list: { ...cad430.list, state: 'deleted' } };
    expect(toArchivedTaskItem(archived).listArchived).toBe(true);
    expect(toArchivedTaskItem(deleted).listArchived).toBe(false);
  });
});
