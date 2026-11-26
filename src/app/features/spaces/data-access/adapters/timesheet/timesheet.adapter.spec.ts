import type { ListTimesheetPage } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toListTimesheet, toTimesheetEntry } from './timesheet.adapter';

/**
 * Constant firstPage
 *
 * @description
 * The first page of Sprint 14's week of November 2, as the gateway answers it.
 *
 * @type {ListTimesheetPage}
 */
const firstPage: ListTimesheetPage = {
  listId: 'l-sprint14',
  weekStart: '2026-11-02',
  days: [
    { date: '2026-11-02', totalMinutes: 75 },
    { date: '2026-11-03', totalMinutes: 120 },
    { date: '2026-11-04', totalMinutes: 90 },
    { date: '2026-11-05', totalMinutes: 170 },
    { date: '2026-11-06', totalMinutes: 60 },
    { date: '2026-11-07', totalMinutes: 245 },
    { date: '2026-11-08', totalMinutes: 125 },
  ],
  totalMinutes: 885,
  items: [
    {
      author: { userId: 'u-cm' },
      taskKey: 'CAD-482',
      name: 'SSO screen',
      status: 'progress',
      minutesByDay: [0, 0, 0, 0, 0, 150, 45],
      totalMinutes: 195,
    },
  ],
  nextCursor: 'c2',
};

describe('timesheet adapter', () => {
  it('maps a row to one person on one task', () => {
    expect(toTimesheetEntry(firstPage.items[0])).toEqual({
      userId: 'u-cm',
      taskKey: 'CAD-482',
      name: 'SSO screen',
      status: 'progress',
      minutesByDay: [0, 0, 0, 0, 0, 150, 45],
      totalMinutes: 195,
    });
  });

  it('always keeps seven whole days of minutes', () => {
    const entry: ReturnType<typeof toTimesheetEntry> = toTimesheetEntry({
      ...firstPage.items[0],
      minutesByDay: [30.4, -5, 10],
    });
    expect(entry.minutesByDay).toEqual([30, 0, 10, 0, 0, 0, 0]);
  });

  it('joins the pages of a week, totals from the first one', () => {
    const second: ListTimesheetPage = {
      ...firstPage,
      items: [
        {
          author: { userId: 'u-hd' },
          taskKey: 'CAD-479',
          name: 'Rate limit',
          status: 'review',
          minutesByDay: [0, 120, 0, 0, 0, 0, 80],
          totalMinutes: 200,
        },
      ],
      nextCursor: null,
    };
    const sheet: ReturnType<typeof toListTimesheet> = toListTimesheet([firstPage, second]);
    expect(sheet.listId).toBe('l-sprint14');
    expect(sheet.weekStart).toBe('2026-11-02');
    expect(sheet.totalMinutes).toBe(885);
    expect(sheet.days.map((day) => day.totalMinutes)).toEqual([75, 120, 90, 170, 60, 245, 125]);
    expect(sheet.entries.map((entry) => entry.taskKey)).toEqual(['CAD-482', 'CAD-479']);
  });
});
