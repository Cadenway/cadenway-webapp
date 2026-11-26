import type { SprintBurndownDay, SprintReport } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toSprintReport } from './sprint-report.adapter';

/**
 * Constant sprint14
 *
 * @description
 * The first page of the mockup's `Sprint 14` report, as the gateway answers it.
 *
 * @type {SprintReport}
 */
const sprint14: SprintReport = {
  listId: 'l-sprint14',
  name: 'Sprint 14',
  startDate: '2026-11-03',
  endDate: '2026-11-17',
  observedAt: '2026-11-08T18:00:00Z',
  coverageStartedAt: '2026-11-03T00:00:00Z',
  openingPoints: 42,
  delivered: {
    points: 15,
    taskCount: 6,
    items: [{ taskKey: 'CAD-471', name: 'SSO sign-in', points: 3, status: 'done' }],
  },
  remaining: { points: 27, taskCount: 9, items: [] },
  projectedRemainingPoints: null,
  items: [],
  nextCursor: null,
  velocity: [
    {
      listId: 'l-sprint13',
      name: 'Sprint 13',
      startDate: '2026-10-20',
      endDate: '2026-11-02',
      openingPoints: 210,
      deliveredPoints: null,
    },
  ],
};

describe('toSprintReport', () => {
  it('maps the figures, the tasks, the joined days and the velocity, keeping unknowns null', () => {
    const days: SprintBurndownDay[] = [
      {
        date: '2026-11-03',
        actualRemainingPoints: 42,
        idealRemainingPoints: 42,
        projectedRemainingPoints: null,
      },
      {
        date: '2026-11-04',
        actualRemainingPoints: null,
        idealRemainingPoints: 39,
        projectedRemainingPoints: 40,
      },
    ];

    expect(toSprintReport(sprint14, days)).toEqual({
      listId: 'l-sprint14',
      name: 'Sprint 14',
      startDate: '2026-11-03',
      endDate: '2026-11-17',
      committed: 42,
      delivered: {
        points: 15,
        taskCount: 6,
        tasks: [{ key: 'CAD-471', name: 'SSO sign-in', points: 3, status: 'done' }],
      },
      remaining: { points: 27, taskCount: 9, tasks: [] },
      projected: null,
      days: [
        { date: '2026-11-03', actual: 42, ideal: 42, projected: null },
        { date: '2026-11-04', actual: null, ideal: 39, projected: 40 },
      ],
      velocity: [{ listId: 'l-sprint13', name: 'Sprint 13', committed: 210, delivered: null }],
    });
  });

  it('keeps an unknown part of the scope null', () => {
    expect(toSprintReport({ ...sprint14, delivered: null, remaining: null }, []).delivered).toBe(
      null,
    );
  });
});
