import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { TaskDetailOpener } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { UnavailableRouteError } from '@shared/route-errors';

import { TimesheetApi } from '../../data-access/services/timesheet-api/timesheet-api.service';
import type { ListTimesheet, TimesheetEntry } from '../../models/timesheet/timesheet.interface';
import { addDays, mondayOf, TimesheetViewStore } from './timesheet-view.store';

/**
 * Function entry
 *
 * @description
 * One person's minutes on one task of Sprint 14.
 *
 * @param {string} userId - Author.
 * @param {string} taskKey - Task key.
 * @param {readonly number[]} minutesByDay - Minutes from Monday to Sunday.
 * @returns {TimesheetEntry} The entry.
 */
function entry(userId: string, taskKey: string, minutesByDay: readonly number[]): TimesheetEntry {
  return {
    userId,
    taskKey,
    name: `Task ${taskKey}`,
    status: 'progress',
    minutesByDay,
    totalMinutes: minutesByDay.reduce((sum: number, minutes: number) => sum + minutes, 0),
  };
}

/**
 * Function week
 *
 * @description
 * A week of Sprint 14 holding the given entries, its totals added up.
 *
 * @param {string} weekStart - Monday of the week.
 * @param {readonly TimesheetEntry[]} entries - The entries.
 * @returns {ListTimesheet} The week.
 */
function week(weekStart: string, entries: readonly TimesheetEntry[]): ListTimesheet {
  const days: readonly number[] = Array.from({ length: 7 }, (_: unknown, day: number) =>
    entries.reduce((sum: number, item: TimesheetEntry) => sum + item.minutesByDay[day], 0),
  );
  return {
    listId: 'l-sprint14',
    weekStart,
    days: days.map((totalMinutes: number, day: number) => ({
      date: addDays(weekStart, day),
      totalMinutes,
    })),
    totalMinutes: days.reduce((sum: number, minutes: number) => sum + minutes, 0),
    entries,
  };
}

/**
 * Constant thisWeek
 *
 * @description
 * The week of November 2, 2026: Camille on two tasks, Hugo on one of them and another.
 *
 * @type {ListTimesheet}
 */
const thisWeek: ListTimesheet = week('2026-11-02', [
  entry('u-cm', 'CAD-482', [0, 0, 0, 0, 0, 150, 45]),
  entry('u-cm', 'CAD-488', [75, 0, 0, 0, 0, 0, 0]),
  entry('u-hd', 'CAD-479', [0, 120, 0, 0, 0, 0, 80]),
  entry('u-hd', 'CAD-482', [0, 0, 90, 0, 0, 0, 0]),
]);

describe('TimesheetViewStore', () => {
  let api: Record<string, Mock>;
  let notices: Subject<RealtimeChange>;
  let closed: Subject<string>;
  let changed: Subject<string>;
  let organization: WritableSignal<{ id: string }>;
  let store: InstanceType<typeof TimesheetViewStore>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 10));
    notices = new Subject<RealtimeChange>();
    closed = new Subject<string>();
    changed = new Subject<string>();
    organization = signal({ id: 'org-atelier-nord' });
    api = {
      week: vi.fn((_listId: string, weekStart: string) =>
        Promise.resolve(weekStart === thisWeek.weekStart ? thisWeek : week(weekStart, [])),
      ),
      estimates: vi.fn((keys: readonly string[]) =>
        Promise.resolve(new Map(keys.map((key: string) => [key, key === 'CAD-482' ? 480 : null]))),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        TimesheetViewStore,
        { provide: TimesheetApi, useValue: api },
        { provide: WORKSPACE_CONTEXT, useValue: { organization } },
        {
          provide: RealtimeConnection,
          useValue: { watch: vi.fn((): Observable<RealtimeChange> => notices.asObservable()) },
        },
        {
          provide: TaskDetailOpener,
          useValue: { closed: closed.asObservable(), changed: changed.asObservable() },
        },
      ],
    });
    store = TestBed.inject(TimesheetViewStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function shown
   *
   * @description
   * Binds Sprint 14 and waits for its current week.
   *
   * @returns {Promise<void>} Resolves once the week is shown.
   */
  async function shown(): Promise<void> {
    store.show('l-sprint14');
    await expect.poll(() => store.sheet()?.weekStart).toBe('2026-11-02');
  }

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    expect(mondayOf('2026-11-04')).toBe('2026-11-02');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('reads the current week of the list and sums it by person', async () => {
    await shown();

    expect(api['week']).toHaveBeenCalledWith('l-sprint14', '2026-11-02', expect.any(AbortSignal));
    expect(store.days()).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(store.isThisWeek()).toBe(true);
    expect(store.hasRead()).toBe(true);
    expect(store.empty()).toBe(false);
    expect(store.people().map((person) => [person.userId, person.totalMinutes])).toEqual([
      ['u-cm', 270],
      ['u-hd', 290],
    ]);
    expect(store.people()[0].minutesByDay).toEqual([75, 0, 0, 0, 0, 150, 45]);
    expect(store.figures()).toEqual({
      totalMinutes: 560,
      taskCount: 3,
      workedDays: 3,
      averageMinutes: 95,
      topTask: { taskKey: 'CAD-482', name: 'Task CAD-482', minutes: 285 },
    });
  });

  it('adds up the estimates of the tasks with time', async () => {
    await shown();

    await expect.poll(() => store.estimatedMinutes()).toBe(480);
    expect(api['estimates']).toHaveBeenCalledWith(
      ['CAD-479', 'CAD-482', 'CAD-488'],
      expect.any(AbortSignal),
    );
  });

  it('keeps the week when its estimates fail, and reads them again on Retry', async () => {
    api['estimates'].mockRejectedValueOnce(new Error('unavailable'));
    await shown();

    await expect.poll(() => store.estimates.error()).toBeTruthy();
    expect(store.estimatedMinutes()).toBeNull();
    expect(store.sheet()).toBe(thisWeek);

    store.estimates.reload();
    await expect.poll(() => store.estimatedMinutes()).toBe(480);
  });

  it('moves a week back and forward, and back to this week', async () => {
    await shown();

    store.previousWeek();
    expect(store.weekStart()).toBe('2026-10-26');
    expect(store.isThisWeek()).toBe(false);
    expect(store.sheet()).toBeUndefined();
    await expect.poll(() => store.sheet()?.weekStart).toBe('2026-10-26');
    expect(store.empty()).toBe(true);
    expect(store.figures()?.topTask).toBeNull();

    store.nextWeek();
    store.nextWeek();
    expect(store.weekStart()).toBe('2026-11-09');

    store.showThisWeek();
    expect(store.weekStart()).toBe('2026-11-02');
    expect(store.isThisWeek()).toBe(true);
  });

  it('leaves a first failed read to the route boundary', async () => {
    api['week'].mockRejectedValueOnce(new UnavailableRouteError(503, 'req-1'));
    store.show('l-sprint14');

    await expect.poll(() => store.timesheet.error()).toBeInstanceOf(UnavailableRouteError);
    expect(store.hasRead()).toBe(false);
    expect(store.sheet()).toBeUndefined();
  });

  it('keeps the week shown when a refresh fails', async () => {
    await shown();
    api['week'].mockRejectedValueOnce(new UnavailableRouteError(503, 'req-2'));

    store.reload();
    await expect.poll(() => store.timesheet.error()).toBeTruthy();
    expect(store.sheet()).toBe(thisWeek);
    expect(store.hasRead()).toBe(true);

    store.reload();
    await expect.poll(() => store.timesheet.error()).toBeUndefined();
    expect(api['week']).toHaveBeenCalledTimes(3);
  });

  it('shows nothing of another week whose read failed', async () => {
    await shown();
    api['week'].mockRejectedValueOnce(new UnavailableRouteError(503, 'req-3'));

    store.nextWeek();
    await expect.poll(() => store.timesheet.error()).toBeTruthy();
    expect(store.sheet()).toBeUndefined();
    expect(store.hasRead()).toBe(true);
  });

  it('reads again once after the detail closes and after a notice of the list', async () => {
    await shown();

    closed.next('CAD-482');
    changed.next('CAD-482');
    await expect.poll(() => api['week'].mock.calls.length, { timeout: 3000 }).toBe(2);

    notices.next({ id: 'n1', type: 'list.tasks-changed.v1', at: '', data: { listId: 'l-other' } });
    notices.next({ id: 'n2', type: 'comment.created.v1', at: '', data: { taskId: 't1' } });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(api['week']).toHaveBeenCalledTimes(2);

    notices.next({ id: 'n3', type: 'task.updated.v1', at: '', data: { taskId: 't1' } });
    await expect.poll(() => api['week'].mock.calls.length, { timeout: 3000 }).toBe(3);
  });

  it('starts another list over on the current week', async () => {
    await shown();
    store.previousWeek();

    store.show('l-design-system');
    expect(store.weekStart()).toBe('2026-11-02');
    expect(store.hasRead()).toBe(false);
    await expect
      .poll(() => api['week'].mock.calls.at(-1)?.slice(0, 2))
      .toEqual(['l-design-system', '2026-11-02']);
  });

  it('reads again in another organization', async () => {
    await shown();

    organization.set({ id: 'org-other' });
    await expect.poll(() => api['week'].mock.calls.length).toBe(2);
  });
});
