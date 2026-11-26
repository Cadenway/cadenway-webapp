import type { ListTimesheetPage, ListWorkloadPage } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { WorkloadWindow } from '../../../models/workload/workload.interface';
import { addSpentMinutes, toWorkloadQuery, toWorkloadWindow } from './workload.adapter';

/**
 * Function timesheet
 *
 * @description
 * A timesheet page of Sprint 14 with the given rows.
 *
 * @param {readonly { userId: string; minutes: number }[]} rows - Author and minutes of each row.
 * @returns {ListTimesheetPage} The page.
 */
function timesheet(rows: readonly { userId: string; minutes: number }[]): ListTimesheetPage {
  return {
    listId: 'sprint-14',
    weekStart: '2026-11-23',
    days: [],
    totalMinutes: 0,
    items: rows.map((row: { userId: string; minutes: number }) => ({
      author: { userId: row.userId },
      taskKey: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'progress',
      minutesByDay: [row.minutes, 0, 0, 0, 0, 0, 0],
      totalMinutes: row.minutes,
    })),
    nextCursor: null,
  };
}

describe('workload adapter', () => {
  it('sends the view filters, level and week without the sort', () => {
    expect(
      toWorkloadQuery(
        {
          status: ['todo'],
          priority: ['haute'],
          assignee: ['me', 'none'],
          label: ['Auth'],
          search: 'sso',
          milestone: true,
          level: 'all',
          sort: 'due',
        },
        '2026-11-23',
        'c-2',
        100,
      ),
    ).toEqual({
      weekStart: '2026-11-23',
      status: ['todo'],
      priority: ['haute'],
      assignee: ['me', 'none'],
      label: ['Auth'],
      search: 'sso',
      milestone: true,
      level: 'all',
      cursor: 'c-2',
      limit: 100,
    });
    expect(toWorkloadQuery({ level: 'roots', sort: 'manual' }, '2026-11-23', null, 50)).toEqual({
      weekStart: '2026-11-23',
      level: 'roots',
      limit: 50,
    });
  });

  it('maps a page, the unassigned bucket included', () => {
    const page: ListWorkloadPage = {
      listId: 'sprint-14',
      weekStart: '2026-11-23',
      days: [{ date: '2026-11-23', totalMinutes: 240, dailyCapacityMinutes: 360 }],
      totalMinutes: 240,
      items: [
        {
          assignee: { userId: 'u-camille' },
          taskKey: 'CAD-482',
          name: 'Redesign the SSO sign-in screen',
          status: 'todo',
          minutesByDay: [120],
          totalMinutes: 120,
        },
        {
          assignee: null,
          taskKey: 'CAD-483',
          name: 'Organization quotas page',
          status: 'progress',
          minutesByDay: [120],
          totalMinutes: 120,
        },
      ],
      nextCursor: 'c-2',
    };

    const window: WorkloadWindow = toWorkloadWindow(page);

    expect(window).toEqual({
      weekStart: '2026-11-23',
      days: [{ date: '2026-11-23', totalMinutes: 240, capacityMinutes: 360 }],
      items: [
        {
          assigneeId: 'u-camille',
          taskKey: 'CAD-482',
          name: 'Redesign the SSO sign-in screen',
          status: 'todo',
          minutesByDay: [120],
        },
        {
          assigneeId: null,
          taskKey: 'CAD-483',
          name: 'Organization quotas page',
          status: 'progress',
          minutesByDay: [120],
        },
      ],
      nextCursor: 'c-2',
    });
  });

  it('sums the recorded minutes of each author across pages', () => {
    const spent: Record<string, number> = {};
    addSpentMinutes(
      spent,
      timesheet([
        { userId: 'u-camille', minutes: 90 },
        { userId: 'u-ines', minutes: 30 },
      ]),
    );
    addSpentMinutes(spent, timesheet([{ userId: 'u-camille', minutes: 45 }]));

    expect(spent).toEqual({ 'u-camille': 135, 'u-ines': 30 });
  });
});
