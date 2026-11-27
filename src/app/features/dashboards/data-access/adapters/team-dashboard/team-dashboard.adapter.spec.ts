import type { GetTeamDashboardClientResult } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { TeamDashboard } from '../../../models/team-dashboard/team-dashboard.interface';
import { toTeamDashboard } from './team-dashboard.adapter';

/**
 * Constant atelierNord
 *
 * @description
 * Atelier Nord's dashboard on Sunday 8 November 2026 over 8 weeks (`App.dc.html` lines 6667-6704):
 * one late task of Sprint 14 assigned to Camille.
 *
 * @type {GetTeamDashboardClientResult}
 */
const atelierNord: GetTeamDashboardClientResult = {
  today: '2026-11-08',
  timeZone: 'Europe/Paris',
  weeks: 8,
  observedAt: '2026-11-08T09:00:00Z',
  openCount: 24,
  lateCount: 3,
  blockedCount: 1,
  completedCount: 52,
  byStatus: [
    { status: 'todo', count: 9 },
    { status: 'blocked', count: 1 },
  ],
  overdueTasks: [
    {
      key: 'CAD-482',
      name: 'Export the sprint report',
      status: 'progress',
      cancelReason: null,
      priority: 'haute',
      assignees: [{ userId: 'u-camille' }],
      dueDate: '2026-11-05',
      startDate: null,
      estimateMinutes: null,
      labels: ['Reports'],
      parentKey: null,
      listId: 'sprint-14',
      spaceId: 'product',
      subtaskCounts: { total: 3, closed: 2 },
      checklistCounts: { total: 2, done: 1 },
      completedAt: null,
      createdAt: '2026-10-20T08:00:00Z',
      version: 7,
    },
  ],
  assigneeThreshold: 6,
  assignees: [{ userId: 'u-camille', openCount: 7 }],
  completions: [
    { startsOn: '2026-09-14', completedCount: 6 },
    { startsOn: '2026-11-02', completedCount: 3 },
  ],
};

describe('toTeamDashboard', () => {
  it('keeps the counters and numbers each week from its Monday', () => {
    const dashboard: TeamDashboard = toTeamDashboard(atelierNord);

    expect(dashboard).toMatchObject({
      today: '2026-11-08',
      weeks: 8,
      openCount: 24,
      lateCount: 3,
      blockedCount: 1,
      completedCount: 52,
      assigneeThreshold: 6,
      assignees: [{ userId: 'u-camille', openCount: 7 }],
      byStatus: [
        { status: 'todo', count: 9 },
        { status: 'blocked', count: 1 },
      ],
    });
    expect(dashboard.completions).toEqual([
      { startsOn: '2026-09-14', week: 38, completed: 6 },
      { startsOn: '2026-11-02', week: 45, completed: 3 },
    ]);
  });

  it('maps the late tasks to task summaries keyed by their key', () => {
    expect(toTeamDashboard(atelierNord).overdueTasks).toEqual([
      {
        id: 'CAD-482',
        key: 'CAD-482',
        name: 'Export the sprint report',
        status: 'progress',
        cancelReason: null,
        priority: 'haute',
        assigneeIds: ['u-camille'],
        due: '2026-11-05',
        start: null,
        labels: ['Reports'],
        subtasks: { closed: 2, total: 3 },
        checklist: { closed: 1, total: 2 },
        comments: null,
        parentKey: null,
        milestone: false,
        recurrence: 'none',
        listId: 'sprint-14',
        spaceId: 'product',
        version: 7,
      },
    ]);
  });
});
