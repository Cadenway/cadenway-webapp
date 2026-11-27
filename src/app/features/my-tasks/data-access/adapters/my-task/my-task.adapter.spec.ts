import { describe, expect, it } from 'vitest';

import {
  type MyTaskDto,
  toMyTask,
  toMyTasksCounts,
  toPerson,
  type MemberDto,
} from './my-task.adapter';

describe('my task adapter', () => {
  it('maps a task of listMyTasks to the summary the rows show', () => {
    const task: MyTaskDto = {
      key: 'CAD-482',
      name: 'Review of the SSO flow',
      status: 'review',
      cancelReason: null,
      priority: 'urgente',
      assignees: [{ userId: 'u-camille' }, { userId: 'u-ines' }],
      dueDate: '2026-11-10',
      startDate: '2026-11-03',
      estimateMinutes: null,
      labels: ['sso'],
      parentKey: null,
      listId: 'l-sprint-14',
      spaceId: 'sp-product',
      subtaskCounts: { closed: 1, total: 3 },
      checklistCounts: { done: 2, total: 4 },
      completedAt: null,
      createdAt: '2026-11-02T08:00:00Z',
      version: 7,
    };

    expect(toMyTask(task)).toEqual({
      id: 'CAD-482',
      key: 'CAD-482',
      name: 'Review of the SSO flow',
      status: 'review',
      cancelReason: null,
      priority: 'urgente',
      assigneeIds: ['u-camille', 'u-ines'],
      due: '2026-11-10',
      start: '2026-11-03',
      labels: ['sso'],
      subtasks: { closed: 1, total: 3 },
      checklist: { closed: 2, total: 4 },
      comments: null,
      parentKey: null,
      milestone: false,
      recurrence: 'none',
      listId: 'l-sprint-14',
      spaceId: 'sp-product',
      version: 7,
    });
  });

  it('maps the counts and a member', () => {
    expect(toMyTasksCounts({ open: 6, closed: 14 })).toEqual({ open: 6, closed: 14 });
    expect(toPerson({ userId: 'u-camille', name: 'Camille Martin' } as MemberDto)).toEqual({
      id: 'u-camille',
      name: 'Camille Martin',
      initials: 'CM',
      avatar: null,
    });
  });
});
