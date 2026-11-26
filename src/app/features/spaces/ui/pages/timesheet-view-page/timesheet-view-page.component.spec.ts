import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';
import { TaskDetailOpener } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { UnavailableRouteError } from '@shared/route-errors';

import { TimesheetApi } from '../../../data-access/services/timesheet-api/timesheet-api.service';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type { ListTimesheet, TimesheetEntry } from '../../../models/timesheet/timesheet.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { addDays, TimesheetViewStore } from '../../../state/timesheet-view/timesheet-view.store';
import { TimesheetViewPage } from './timesheet-view-page.component';

/**
 * Function entry
 *
 * @description
 * One person's minutes on one task of Sprint 14.
 *
 * @param {string} userId - Author.
 * @param {string} taskKey - Task key.
 * @param {string} name - Task name.
 * @param {readonly number[]} minutesByDay - Minutes from Monday to Sunday.
 * @returns {TimesheetEntry} The entry.
 */
function entry(
  userId: string,
  taskKey: string,
  name: string,
  minutesByDay: readonly number[],
): TimesheetEntry {
  return {
    userId,
    taskKey,
    name,
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
 * The mockup's week of November 2 (`TIME_LOG` of `App.dc.html`), one entry of a former member.
 *
 * @type {ListTimesheet}
 */
const thisWeek: ListTimesheet = week('2026-11-02', [
  entry('u-cm', 'CAD-482', 'SSO screen', [0, 0, 0, 0, 0, 150, 45]),
  entry('u-hd', 'CAD-479', 'Rate limit', [0, 120, 0, 0, 0, 0, 80]),
  entry('u-ir', 'CAD-482', 'SSO screen', [0, 0, 0, 0, 0, 95, 0]),
  entry('u-gone', 'CAD-475', 'Custom fields', [0, 0, 0, 170, 60, 0, 0]),
]);

/**
 * Constant members
 *
 * @description
 * The organization's members of Atelier Nord.
 *
 * @type {readonly ListMember[]}
 */
const members: readonly ListMember[] = [
  { userId: 'u-cm', name: 'Camille Martin' },
  { userId: 'u-hd', name: 'Hugo Durand' },
  { userId: 'u-ir', name: 'Inès Robert' },
];

describe('TimesheetViewPage', () => {
  let api: Record<string, Mock>;
  let open: Mock;
  let listId: WritableSignal<string | null>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 10));
    listId = signal('l-sprint14');
    open = vi.fn(() => Promise.resolve(true));
    api = {
      week: vi.fn((_list: string, weekStart: string) =>
        Promise.resolve(weekStart === thisWeek.weekStart ? thisWeek : week(weekStart, [])),
      ),
      estimates: vi.fn((keys: readonly string[]) =>
        Promise.resolve(new Map(keys.map((key: string) => [key, key === 'CAD-482' ? 480 : null]))),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: ':org/l/:listId/timesheet',
              providers: [TimesheetViewStore],
              data: { unavailableTitle: 'Could not load the tasks' },
              component: TimesheetViewPage,
            },
          ],
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        { provide: TimesheetApi, useValue: api },
        {
          provide: ListPageStore,
          useValue: {
            listId,
            organizationMembers: {
              isLoading: () => false,
              hasValue: () => true,
              value: () => members,
            },
          },
        },
        {
          provide: TaskDetailOpener,
          useValue: {
            open,
            closed: new Subject<string>().asObservable(),
            changed: new Subject<string>().asObservable(),
          },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-1', slug: 'atelier-nord' }) },
        },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function text
   *
   * @description
   * Text of an element of the view by test id.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} id - Test id.
   * @returns {string} Its text, empty when absent.
   */
  function text(harness: RouterTestingHarness, id: string): string {
    harness.detectChanges();
    return (
      harness.routeNativeElement
        ?.querySelector(`[data-testid="${id}"]`)
        ?.textContent.replace(/\s+/gu, ' ')
        .trim() ?? ''
    );
  }

  /**
   * Function button
   *
   * @description
   * A button of the view by its accessible name or text.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} name - Its name.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(harness: RouterTestingHarness, name: string): HTMLButtonElement | undefined {
    harness.detectChanges();
    return [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].find(
      (item: HTMLButtonElement) =>
        item.getAttribute('aria-label') === name || item.textContent.trim() === name,
    );
  }

  it('shows the week with its figures, people, tasks and totals', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14/timesheet',
    );
    await expect.poll(() => text(harness, 'timesheet-table')).toContain('Camille Martin');

    expect(text(harness, 'timesheet-range')).toBe('Week of Nov 2 to Nov 8');
    expect(text(harness, 'timesheet-view')).toContain('This week');
    expect(text(harness, 'timesheet-total')).toBe('Week total: 12 h');
    const kpis: string = text(harness, 'timesheet-kpis');
    expect(kpis).toContain('Week total');
    expect(kpis).toContain('3 tasks');
    expect(kpis).toContain('Average per working day');
    expect(kpis).toContain('1 h 57');
    expect(kpis).toContain('3 days with time');
    expect(kpis).toContain('CAD-482 · SSO screen');
    await expect.poll(() => text(harness, 'timesheet-kpis')).toContain('150% consumed');

    const people: string[] = [
      ...(harness.routeNativeElement?.querySelectorAll('[data-testid="timesheet-person-name"]') ??
        []),
    ].map((cell: Element) => cell.textContent.trim());
    expect(people).toEqual(['Camille Martin', 'Hugo Durand', 'Inès Robert', 'Unknown user']);
    expect(
      [
        ...(harness.routeNativeElement?.querySelectorAll('[data-testid="timesheet-footer"] > *') ??
          []),
      ].map((cell: Element) => cell.textContent.trim()),
    ).toEqual(['Total', '·', '2 h', '·', '2 h 50', '1 h', '4 h 05', '2 h 05', '12 h']);
    expect(text(harness, 'timesheet-breakdown')).toContain('Unknown user');
  });

  it('shows the skeleton while the week is read', async () => {
    api['week'].mockReturnValueOnce(new Promise<ListTimesheet>(() => undefined));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14/timesheet',
    );
    harness.detectChanges();

    const loading: Element | null | undefined = harness.routeNativeElement?.querySelector(
      '[data-testid="timesheet-loading"]',
    );
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(loading?.getAttribute('aria-label')).toBe('Loading the timesheet');
    expect(text(harness, 'timesheet-range')).toBe('Week of Nov 2 to Nov 8');
  });

  it('opens a task row in the detail over the view', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14/timesheet',
    );
    await expect.poll(() => button(harness, 'Open CAD-479 · Rate limit')).toBeDefined();

    button(harness, 'Open CAD-479 · Rate limit')?.click();

    expect(open).toHaveBeenCalledWith('CAD-479', {
      key: 'CAD-479',
      name: 'Rate limit',
      status: 'progress',
      milestone: false,
    });
  });

  it('tells an empty week apart and comes back to this week', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14/timesheet',
    );
    await expect.poll(() => text(harness, 'timesheet-table')).toContain('Camille Martin');

    button(harness, 'Previous week')?.click();
    await expect
      .poll(() => text(harness, 'timesheet-empty'))
      .toContain('No time recorded this week');
    expect(text(harness, 'timesheet-range')).toBe('Week of Oct 26 to Nov 1');
    expect(text(harness, 'timesheet-total')).toBe('Week total: 0 min');

    button(harness, 'Back to this week')?.click();
    await expect.poll(() => text(harness, 'timesheet-table')).toContain('Camille Martin');
    expect(text(harness, 'timesheet-view')).toContain('This week');
  });

  it('retries a failed first read through the route boundary', async () => {
    api['week'].mockRejectedValueOnce(new UnavailableRouteError(503, 'req-1'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14/timesheet',
    );
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Retry');
    expect(text(harness, 'timesheet-view')).toBe('');

    [...document.querySelectorAll('button')]
      .find((item: HTMLButtonElement) => item.textContent.includes('Retry'))
      ?.click();
    await expect.poll(() => api['week'].mock.calls.length).toBe(2);
    await expect.poll(() => text(harness, 'timesheet-table')).toContain('Camille Martin');
  });

  it('shows a failed read of another week in place, whose Retry reads it again', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14/timesheet',
    );
    await expect.poll(() => text(harness, 'timesheet-table')).toContain('Camille Martin');
    api['week'].mockRejectedValueOnce(new UnavailableRouteError(503, 'req-2'));

    button(harness, 'Next week')?.click();
    await expect
      .poll(() => text(harness, 'timesheet-failed'))
      .toContain('The timesheet could not be loaded');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="timesheet-failed"] button')
      ?.click();
    await expect
      .poll(() => text(harness, 'timesheet-empty'))
      .toContain('No time recorded this week');
  });

  it('keeps the figures when the estimates fail, and reads them again on Retry', async () => {
    api['estimates'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14/timesheet',
    );
    await expect
      .poll(() => text(harness, 'timesheet-estimates-failed'))
      .toContain('The estimates could not be loaded.');
    expect(text(harness, 'timesheet-kpis')).toContain('Average per working day');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="timesheet-estimates-failed"] button')
      ?.click();
    await expect.poll(() => text(harness, 'timesheet-kpis')).toContain('150% consumed');
  });
});
