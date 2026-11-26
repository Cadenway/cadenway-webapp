import type {
  GetTaskApprovalClientResult,
  ListTaskDependenciesClientResult,
} from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toTaskApproval, toTaskDependency, toTaskStatusTimes } from './task-property.adapter';

/**
 * Function summary
 *
 * @description
 * A task summary of the gateway, as an edge carries it.
 *
 * @param {string} key - Key of the task.
 * @param {string} name - Its name.
 * @returns {ListTaskDependenciesClientResult['items'][number]['blocker']} The summary.
 */
function summary(
  key: string,
  name: string,
): ListTaskDependenciesClientResult['items'][number]['blocker'] {
  return {
    key,
    name,
    status: 'progress',
    cancelReason: null,
    priority: 'haute',
    assignees: [],
    dueDate: '2026-11-10',
    startDate: null,
    labels: [],
    parentKey: null,
    listId: 'sprint-14',
    spaceId: 'product',
    subtaskCounts: { closed: 0, total: 0 },
    checklistCounts: { closed: 0, total: 0 },
    version: 3,
  } as unknown as ListTaskDependenciesClientResult['items'][number]['blocker'];
}

describe('task property adapters', () => {
  it('reads an edge from the open task, blocked by or blocking', () => {
    const edge: ListTaskDependenciesClientResult['items'][number] = {
      id: 'd1',
      blocker: summary('CAD-479', 'Sliding sign-in counter'),
      blocked: summary('CAD-482', 'Redesign the SSO sign-in screen'),
    };

    expect(toTaskDependency(edge, 'CAD-482')).toEqual({
      id: 'd1',
      direction: 'blocked-by',
      task: {
        key: 'CAD-479',
        name: 'Sliding sign-in counter',
        status: 'progress',
        milestone: false,
        due: '2026-11-10',
      },
    });
    expect(toTaskDependency(edge, 'CAD-479').direction).toBe('blocks');
  });

  it('reads the reviewers of the current round, an unknown decision as none', () => {
    const state: GetTaskApprovalClientResult = {
      taskKey: 'CAD-482',
      taskVersion: 7,
      taskStatus: 'review',
      current: {
        roundId: 'r1',
        requesterUserId: 'u1',
        requestedAt: '2026-11-06T09:00:00Z',
        status: 'pending',
        reviewers: [
          { reviewerUserId: 'u2', decision: 'approved', decidedAt: null, commentId: null },
          { reviewerUserId: 'u3', decision: 'later', decidedAt: null, commentId: null },
        ],
      },
    };

    expect(toTaskApproval(state)).toEqual({
      taskVersion: 7,
      reviewers: [
        { userId: 'u2', decision: 'approved' },
        { userId: 'u3', decision: null },
      ],
    });
    expect(toTaskApproval({ ...state, current: null }).reviewers).toEqual([]);
  });

  it('gives no time per status for a milestone', () => {
    expect(toTaskStatusTimes({ summary: null })).toBeNull();
    expect(
      toTaskStatusTimes({
        summary: {
          observedAt: '2026-11-08T10:00:00Z',
          coverageStartedAt: '2026-11-02T09:00:00Z',
          complete: true,
          durations: [{ status: 'todo', durationMilliseconds: 3_600_000, active: false }],
        },
      }),
    ).toEqual({
      complete: true,
      durations: [{ status: 'todo', milliseconds: 3_600_000, active: false }],
    });
  });
});
