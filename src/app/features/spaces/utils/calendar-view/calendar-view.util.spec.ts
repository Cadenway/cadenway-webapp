import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '@features/task';

import {
  addDays,
  calendarWindow,
  daysBetween,
  formatLongDay,
  rescheduleChanges,
  weekStart,
} from './calendar-view.util';

/**
 * Function task
 *
 * @description
 * CAD-482 of Sprint 14 with the given dates.
 *
 * @param {string | null} due - Due date.
 * @param {string | null} start - Start date.
 * @returns {TaskSummary} The task.
 */
function task(due: string | null, start: string | null): TaskSummary {
  return {
    id: 'CAD-482',
    key: 'CAD-482',
    name: 'Redesign the SSO sign-in screen',
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due,
    start,
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
}

describe('calendar view dates', () => {
  it('moves plain dates across months and the daylight saving change', () => {
    expect(addDays('2026-10-24', 3)).toBe('2026-10-27');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
    expect(daysBetween('2026-10-24', '2026-11-03')).toBe(10);
    expect(daysBetween('2026-11-03', '2026-10-24')).toBe(-10);
  });

  it('starts the week on Monday', () => {
    expect(weekStart('2026-11-26')).toBe('2026-11-23');
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
  });

  it('covers the six Monday-first weeks of the month grid', () => {
    expect(calendarWindow('month', '2026-11-26')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(calendarWindow('month', '2026-06-01')).toEqual({ from: '2026-06-01', to: '2026-07-12' });
  });

  it('covers Monday to Sunday in the week view', () => {
    expect(calendarWindow('week', '2026-11-26')).toEqual({ from: '2026-11-23', to: '2026-11-29' });
  });

  it('sends the due date alone for a dated task, so the gateway moves its start', () => {
    expect(rescheduleChanges(task('2026-11-27', '2026-11-23'), '2026-12-01')).toEqual({
      dueDate: '2026-12-01',
    });
  });

  it('sends nothing when the task already has that due date', () => {
    expect(rescheduleChanges(task('2026-11-27', null), '2026-11-27')).toBeNull();
  });

  it('keeps the start of an undated task unless it would come after the new due date', () => {
    expect(rescheduleChanges(task(null, null), '2026-11-30')).toEqual({ dueDate: '2026-11-30' });
    expect(rescheduleChanges(task(null, '2026-11-20'), '2026-11-30')).toEqual({
      dueDate: '2026-11-30',
    });
    expect(rescheduleChanges(task(null, '2026-12-04'), '2026-11-30')).toEqual({
      dueDate: '2026-11-30',
      startDate: '2026-11-30',
    });
  });

  it('writes a long day capitalized, with the year only outside the current one', () => {
    const now: Date = new Date(2026, 10, 26);
    expect(formatLongDay('2026-11-24', 'en-US', now)).toBe('Tuesday, November 24');
    expect(formatLongDay('2026-11-24', 'fr-FR', now)).toBe('Mardi 24 novembre');
    expect(formatLongDay('2027-01-04', 'en-US', now)).toBe('Monday, January 4, 2027');
  });
});
