import type { GetTaskDetailClientResult } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { TaskDetail } from '../../../models/task-detail/task-detail.interface';
import { toTaskDetail, toTaskPatch } from './task-detail.adapter';

/**
 * Function statuses
 *
 * @description
 * The ten statuses of the Product space, `review` renamed `Code review`.
 *
 * @returns {GetTaskDetailClientResult['space']['statuses']} The statuses.
 */
function statuses(): GetTaskDetailClientResult['space']['statuses'] {
  const status: (
    category: GetTaskDetailClientResult['space']['statuses']['todo']['category'],
    name?: string | null,
  ) => GetTaskDetailClientResult['space']['statuses']['todo'] = (
    category: GetTaskDetailClientResult['space']['statuses']['todo']['category'],
    name: string | null = null,
  ): GetTaskDetailClientResult['space']['statuses']['todo'] => ({ category, name, hidden: false });
  return {
    triage: status('open'),
    backlog: status('open'),
    todo: status('open'),
    progress: status('active'),
    review: status('active', 'Code review'),
    testing: status('active'),
    waiting: status('active'),
    blocked: status('active'),
    done: status('closed'),
    cancelled: status('closed'),
  };
}

/**
 * Function dto
 *
 * @description
 * The gateway's detail of CAD-482, a subtask of CAD-470 without its comments.
 *
 * @param {string | undefined} callerRole - The caller's role on the list.
 * @returns {GetTaskDetailClientResult} The aggregate.
 */
function dto(callerRole: string | undefined): GetTaskDetailClientResult {
  return {
    task: {
      key: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      description: 'Use **tabs**.',
      status: 'cancelled',
      cancelReason: 'duplicate',
      cancelNote: 'replaced by CAD-490',
      priority: 'haute',
      assignees: [{ userId: 'u1' }],
      dueDate: '2026-11-12',
      startDate: null,
      estimateMinutes: 90,
      labels: ['Front'],
      parentKey: 'CAD-470',
      listId: 'sprint-14',
      spaceId: 'product',
      subtaskCounts: { closed: 1, total: 3 },
      checklist: [{ id: 'k1', text: 'Mockups', done: true }],
      checklistCounts: { done: 1, total: 1 },
      completedAt: null,
      createdAt: '2026-11-02T09:00:00Z',
      createdBy: { type: 'user', id: 'u1' },
      updatedAt: '2026-11-06T09:00:00Z',
      version: 4,
    },
    space: {
      id: 'product',
      name: 'Product',
      prefix: 'CAD',
      description: null,
      icon: null,
      color: 'amethyst',
      visibility: 'organization',
      owner: { userId: 'u1' },
      statuses: statuses(),
      nextKey: 'CAD-500',
      createdAt: '2026-01-01T00:00:00Z',
      version: 2,
    },
    list: {
      id: 'sprint-14',
      spaceId: 'product',
      name: 'Sprint 14',
      icon: null,
      color: 'amethyst',
      sprint: null,
      createdAt: '2026-11-01T00:00:00Z',
      version: 1,
      ...(callerRole === undefined ? {} : { callerRole }),
    },
    parent: { key: 'CAD-470', name: 'Sign-in', status: 'todo' },
    subtasks: [],
    partial: ['comments'],
  } as unknown as GetTaskDetailClientResult;
}

describe('toTaskDetail', () => {
  it('maps the task, the space labels, the parent and a missing comments part', () => {
    const detail: TaskDetail = toTaskDetail(dto('edit'));

    expect(detail.task).toMatchObject({
      key: 'CAD-482',
      description: 'Use **tabs**.',
      cancelNote: 'replaced by CAD-490',
      estimateMinutes: 90,
      checklistItems: [{ id: 'k1', text: 'Mockups', done: true }],
      parentKey: 'CAD-470',
      version: 4,
      archivedAt: null,
    });
    expect(detail.space.statuses.find((status) => status.key === 'review')?.label).toBe(
      'Code review',
    );
    expect(detail.parent).toEqual({ key: 'CAD-470', name: 'Sign-in', status: 'todo' });
    expect(detail.comments).toBeNull();
    expect(detail.partial).toEqual(['comments']);
    expect(detail.list.canEdit).toBe(true);
  });

  it('lets the caller edit without a reported role, and not as a viewer', () => {
    expect(toTaskDetail(dto(undefined)).list.canEdit).toBe(true);
    expect(toTaskDetail(dto('view')).list.canEdit).toBe(false);
  });
});

describe('toTaskPatch', () => {
  it('names the dates as the gateway does and sends a blank note as null', () => {
    expect(toTaskPatch({ due: '2026-11-20', start: null, cancelNote: '', name: 'New' })).toEqual({
      dueDate: '2026-11-20',
      startDate: null,
      cancelNote: null,
      name: 'New',
    });
  });
});
