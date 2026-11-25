import type { ListTasksClientResult } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toTaskSummary } from './task-summary.adapter';

/**
 * Constant dto
 *
 * @description
 * CAD-482 of Sprint 14 as `GET /v1/lists/{listId}/tasks` returns it.
 *
 * @type {ListTasksClientResult['items'][number]}
 */
const dto: ListTasksClientResult['items'][number] = {
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  status: 'progress',
  cancelReason: null,
  priority: 'haute',
  assignees: [{ userId: 'u1' }, { userId: 'u2' }],
  dueDate: '2026-11-12',
  startDate: '2026-11-09',
  estimateMinutes: null,
  labels: ['Front', 'Auth', 'Sécurité'],
  parentKey: null,
  listId: 'sprint-14',
  spaceId: 'produit',
  subtaskCounts: { total: 3, closed: 1 },
  checklistCounts: { total: 4, done: 2 },
  completedAt: null,
  createdAt: '2026-11-03T09:00:00Z',
  version: 7,
};

describe('toTaskSummary', () => {
  it('keeps what the rows show, with the key as id and the version to write against', () => {
    expect(toTaskSummary(dto)).toEqual({
      id: 'CAD-482',
      key: 'CAD-482',
      name: 'Refondre l’écran de connexion SSO',
      status: 'progress',
      cancelReason: null,
      priority: 'haute',
      assigneeIds: ['u1', 'u2'],
      due: '2026-11-12',
      start: '2026-11-09',
      labels: ['Front', 'Auth', 'Sécurité'],
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

  it('reads the milestone flag and the recurrence when present', () => {
    expect(toTaskSummary({ ...dto, milestone: true, recurrence: 'weekly' })).toMatchObject({
      milestone: true,
      recurrence: 'weekly',
    });
  });
});
