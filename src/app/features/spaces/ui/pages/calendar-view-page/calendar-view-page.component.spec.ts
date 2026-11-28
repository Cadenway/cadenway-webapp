import { Component, input, type InputSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwCalendarView } from '@cadenway/ui/components/calendar-view';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import {
  type CreatedTask,
  TaskActionsApi,
  TaskCreate,
  TaskDetailOpener,
  type TaskSummary,
} from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { isRouteError, UnavailableRouteError } from '@shared/route-errors';

import { ListTasksApi } from '../../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import type { ListTaskItem } from '../../../models/list-tasks/list-tasks.interface';
import type { TaskFieldWriteResult } from '../../../models/view-task-write/view-task-write.interface';
import { CALENDAR_VIEW_PROVIDERS } from '../../../state/calendar-view/calendar-view.providers';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { CalendarViewPage } from './calendar-view-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * The route's error boundary, showing the kind of the route error it receives.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="error">{{ kindOf(error()) }}</p>',
})
class FakeBoundary {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * The error the router gives.
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();
  // #endregion

  // #region Methods
  /**
   * Method kindOf
   *
   * @description
   * The kind of the route error in the chain of causes.
   *
   * @param {unknown} error - The error.
   * @returns {string} Its kind, `other` otherwise.
   */
  protected kindOf(error: unknown): string {
    let current: unknown = error;
    while (current instanceof Error) {
      if (isRouteError(current)) return current.kind;
      current = current.cause;
    }
    return 'other';
  }
  // #endregion
}

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {string} name - Task name.
 * @param {string | null} due - Due date.
 * @returns {TaskSummary} The task.
 */
function task(key: string, name: string, due: string | null): TaskSummary {
  return {
    id: key,
    key,
    name,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due,
    start: null,
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

/**
 * Constant sprintTasks
 *
 * @description
 * Sprint 14: CAD-482 due on Friday, November 27, CAD-490 without a due date.
 *
 * @type {readonly TaskSummary[]}
 */
const sprintTasks: readonly TaskSummary[] = [
  task('CAD-482', 'Redesign the SSO sign-in screen', '2026-11-27'),
  task('CAD-490', 'Write the onboarding checklist', null),
];

/**
 * Function ready
 *
 * @description
 * A resource that answered.
 *
 * @param {unknown} value - Its value.
 * @returns {object} The resource-like fake.
 */
function ready(value: unknown): object {
  return {
    hasValue: () => true,
    value: () => value,
    error: () => undefined,
    isLoading: () => false,
    reload: vi.fn(),
  };
}

describe('CalendarViewPage', () => {
  let page: Mock<ListTasksApi['page']>;
  let update: Mock<ListTasksApi['update']>;
  let toasts: Record<string, Mock>;
  let createOpen: Mock<(options?: unknown) => boolean>;
  let detailOpen: Mock<(key: string, preview?: unknown) => Promise<boolean>>;

  /**
   * Function answer
   *
   * @description
   * The gateway's answer: the tasks due in the window, or every task without one.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks of the list.
   * @returns {ListTasksApi['page']} The fake read.
   */
  function answer(tasks: readonly TaskSummary[]): ListTasksApi['page'] {
    return (_listId, _query, _group, _cursor, _limit, _signal, due): Promise<ListTaskPage> => {
      const items: readonly TaskSummary[] = due
        ? tasks.filter(
            (item: TaskSummary): boolean =>
              item.due !== null && item.due >= due.from && item.due <= due.to,
          )
        : tasks;
      return Promise.resolve({ items, nextCursor: null, total: items.length });
    };
  }

  /**
   * Function open
   *
   * @description
   * Opens the `Calendar` view of Sprint 14 and waits until its skeletons are gone.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/l/sprint-14/calendar');
    await settle(harness);
    return harness;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the view shows no skeleton.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[aria-busy="true"]') ?? null;
      })
      .toBeNull();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /**
   * Function hostOf
   *
   * @description
   * The element of the routed view.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The view.
   */
  function hostOf(harness: RouterTestingHarness): HTMLElement {
    const host: HTMLElement | null = harness.routeNativeElement;
    if (!host) throw new Error('Expected the routed view.');
    return host;
  }

  /**
   * Function gridOf
   *
   * @description
   * The calendar brick of the view.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {CwCalendarView<ListTaskItem>} The calendar.
   */
  function gridOf(harness: RouterTestingHarness): CwCalendarView<ListTaskItem> {
    return harness.routeDebugElement?.query(By.directive(CwCalendarView))
      .componentInstance as CwCalendarView<ListTaskItem>;
  }

  /**
   * Function panelOf
   *
   * @description
   * The `No due date` panel.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The panel.
   */
  function panelOf(harness: RouterTestingHarness): HTMLElement {
    const panel: HTMLElement | null = hostOf(harness).querySelector('aside');
    if (!panel) throw new Error('Expected the panel.');
    return panel;
  }

  /**
   * Function menuItem
   *
   * @description
   * The open menu's item whose text starts with a label.
   *
   * @param {string} label - The label.
   * @returns {HTMLElement | undefined} The item.
   */
  function menuItem(label: string): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (element: HTMLElement): boolean => element.textContent.trim().startsWith(label),
    );
  }

  /**
   * Function required
   *
   * @description
   * The element, failing the test when it is missing.
   *
   * @param {T | undefined | null} element - The element looked for.
   * @returns {T} The element.
   */
  function required<T>(element: T | undefined | null): T {
    expect(element).toBeTruthy();
    return element as T;
  }

  /**
   * Function shownToasts
   *
   * @description
   * The titles and descriptions of the toasts shown, as text.
   *
   * @returns {string} The toasts.
   */
  function shownToasts(): string {
    return JSON.stringify(toasts['show'].mock.calls);
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 10, 26, 10), toFake: ['Date'] });
    page = vi.fn<ListTasksApi['page']>(answer(sprintTasks));
    update = vi.fn<ListTasksApi['update']>((): Promise<TaskFieldWriteResult> =>
      Promise.resolve({ kind: 'done', version: 4 }),
    );
    toasts = {
      show: vi.fn(() => 'toast-1'),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      toasts: vi.fn(() => []),
    };
    createOpen = vi.fn(() => true);
    detailOpen = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: 'l/:listId/calendar',
              providers: [
                ListViewStore,
                {
                  provide: ListPageStore,
                  useValue: {
                    listId: () => 'sprint-14',
                    space: ready({ id: 'product', statuses: [] }),
                    organizationMembers: ready([{ userId: 'u-ines', name: 'Inès Robert' }]),
                    refreshCounts: vi.fn(),
                  },
                },
                ...CALENDAR_VIEW_PROVIDERS,
                {
                  provide: ListTasksApi,
                  useValue: { page, update, groups: vi.fn(), subtasks: vi.fn() },
                },
              ],
              component: CalendarViewPage,
            },
          ],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        {
          provide: TaskApi,
          useValue: {
            changeStatus: (key: string, version: number, status: StatusKey) =>
              of({ ...sprintTasks[0], status, version: version + 1 }),
            read: vi.fn(),
          },
        },
        { provide: TaskActionsApi, useValue: { bulk: vi.fn(), remind: vi.fn(), restore: vi.fn() } },
        { provide: CwToastService, useValue: toasts },
        { provide: RealtimeConnection, useValue: { watch: () => new Subject() } },
        {
          provide: SpacesNavigationStore,
          useValue: {
            request: vi.fn(),
            spaces: ready([]),
            overviews: ready({}),
            openDialog: vi.fn(),
          },
        },
        {
          provide: TaskDetailOpener,
          useValue: {
            closed: new Subject<string>(),
            changed: new Subject<string>(),
            open: detailOpen,
          },
        },
        {
          provide: TaskCreate,
          useValue: {
            created: new Subject<CreatedTask>(),
            open: createOpen,
            useDefaults: vi.fn(),
          },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal({ id: 'org-atelier-nord', slug: 'atelier-nord' }),
            user: () => ({ id: 'u-camille' }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the dated tasks on the grid and the undated ones in the panel', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    expect(host.querySelector('[data-calendar-task="CAD-482"]')?.textContent).toContain(
      'Redesign the SSO sign-in screen',
    );
    expect(host.querySelector('[role="grid"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Previous month"]')).not.toBeNull();
    expect(gridOf(harness).maxPerDay()).toBe(3);
    expect(gridOf(harness).weekStartsOn()).toBe(1);

    const panel: HTMLElement = panelOf(harness);
    const heading: HTMLElement = required(panel.querySelector('h2'));
    expect(heading.textContent).toContain('No due date');
    expect(heading.querySelector('span')?.textContent.trim()).toBe('1');
    expect(panel.textContent).toContain('Drag a task onto a day to schedule it.');
    expect(panel.textContent).toContain('Write the onboarding checklist');
    expect(panel.textContent).not.toContain('Redesign the SSO sign-in screen');
    expect(page).toHaveBeenCalledWith(
      'sprint-14',
      expect.anything(),
      null,
      null,
      100,
      expect.anything(),
      { from: '2026-10-26', to: '2026-12-06' },
    );
  });

  it('reschedules a task dropped from the panel, with a toast that offers Undo', async () => {
    const harness: RouterTestingHarness = await open();

    gridOf(harness).itemSchedule.emit({
      data: 'CAD-490',
      date: new Date(2026, 10, 30),
      allDay: true,
    });
    harness.detectChanges();
    expect(panelOf(harness).textContent).toContain('All tasks have a due date.');
    await settle(harness);

    expect(update).toHaveBeenCalledWith('CAD-490', 3, { dueDate: '2026-11-30' });
    expect(shownToasts()).toContain('CAD-490 rescheduled');
    expect(shownToasts()).toContain('Due: Monday, November 30.');
    const options: { readonly undo?: unknown } | undefined = toasts['show'].mock.calls[0][1] as
      { readonly undo?: unknown } | undefined;
    expect(typeof options?.undo).toBe('function');
    expect(hostOf(harness).querySelector('[data-calendar-task="CAD-490"]')).not.toBeNull();
  });

  it('puts a task back in the panel when the gateway refuses its schedule', async () => {
    update.mockResolvedValueOnce({ kind: 'refused', stale: false });
    const harness: RouterTestingHarness = await open();

    gridOf(harness).itemSchedule.emit({
      data: 'CAD-490',
      date: new Date(2026, 10, 30),
      allDay: true,
    });
    await settle(harness);

    expect(panelOf(harness).textContent).toContain('Write the onboarding checklist');
    expect(toasts['error']).toHaveBeenCalled();
  });

  it('moves a task of the grid to the day it is dropped on', async () => {
    const harness: RouterTestingHarness = await open();
    const grid: CwCalendarView<ListTaskItem> = gridOf(harness);
    const item: ListTaskItem = required(
      grid.items().find((entry: ListTaskItem) => entry.task.key === 'CAD-482'),
    );

    grid.itemMove.emit({
      item,
      start: new Date(2026, 11, 2),
      end: new Date(2026, 11, 2),
      allDay: true,
    });
    await settle(harness);

    expect(update).toHaveBeenCalledWith('CAD-482', 3, { dueDate: '2026-12-02' });
    expect(shownToasts()).toContain('Due: Wednesday, December 2.');
  });

  it('hands a panel task to the grid on Space, for the keyboard drop', async () => {
    const harness: RouterTestingHarness = await open();
    const grab: ReturnType<typeof vi.spyOn> = vi.spyOn(gridOf(harness), 'scheduleWithKeyboard');
    const card: HTMLButtonElement = required(panelOf(harness).querySelector('button'));

    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

    expect(grab).toHaveBeenCalledWith('CAD-490', 'Write the onboarding checklist');
  });

  it('opens a task of the panel on a click', async () => {
    const harness: RouterTestingHarness = await open();

    required(panelOf(harness).querySelector('button')).click();

    expect(detailOpen).toHaveBeenCalledWith('CAD-490', expect.objectContaining({ key: 'CAD-490' }));
  });

  it('creates a task due on a day from its button and from its menu', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    const today: HTMLElement = required(
      host.querySelector<HTMLElement>('[role="gridcell"][aria-current="date"]'),
    );
    required(
      [...today.querySelectorAll<HTMLButtonElement>('button')].find(
        (button: HTMLButtonElement): boolean =>
          button.getAttribute('aria-label')?.startsWith('Add a task on') ?? false,
      ),
    ).click();
    expect(createOpen).toHaveBeenLastCalledWith({ listId: 'sprint-14', due: '2026-11-26' });

    today.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    await settle(harness);
    expect(document.body.textContent).toContain('Thursday, November 26');
    expect(menuItem('Go to today')).toBeDefined();
    required(menuItem('New task on that day')).click();
    expect(createOpen).toHaveBeenCalledTimes(2);
    expect(createOpen).toHaveBeenLastCalledWith({ listId: 'sprint-14', due: '2026-11-26' });
  });

  it('opens the task menu, not the day menu, on a right click on a task of the grid', async () => {
    const harness: RouterTestingHarness = await open();
    const frame: HTMLElement = required(
      hostOf(harness)
        .querySelector('[data-calendar-task="CAD-482"]')
        ?.closest<HTMLElement>('button'),
    );

    frame.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    await settle(harness);

    expect(document.body.textContent).toContain('CAD-482');
    expect(menuItem('Status')).toBeDefined();
    expect(menuItem('New task on that day')).toBeUndefined();
  });

  it('shows the panel read failure in place, and reads it again on Retry', async () => {
    page.mockImplementation(
      (_listId, _query, _group, _cursor, _limit, _signal, due): Promise<ListTaskPage> =>
        due
          ? Promise.resolve({ items: [sprintTasks[0]], nextCursor: null, total: 1 })
          : Promise.reject(new Error('unavailable')),
    );
    const harness: RouterTestingHarness = await open();
    const panel: HTMLElement = panelOf(harness);
    expect(panel.querySelector('[role="alert"]')?.textContent).toContain(
      'The tasks without a due date could not be loaded.',
    );
    expect(hostOf(harness).querySelector('[data-calendar-task="CAD-482"]')).not.toBeNull();

    page.mockImplementation(answer(sprintTasks));
    const calls: number = page.mock.calls.length;
    required(
      [...panel.querySelectorAll<HTMLButtonElement>('button')].find(
        (button: HTMLButtonElement): boolean => button.textContent.trim() === 'Retry',
      ),
    ).click();
    await settle(harness);

    expect(page.mock.calls.length).toBeGreaterThan(calls);
    expect(panelOf(harness).querySelector('[role="alert"]')).toBeNull();
    expect(panelOf(harness).textContent).toContain('Write the onboarding checklist');
  });

  it('drops the panel tasks of the previous filters while the new ones read and fail', async () => {
    const harness: RouterTestingHarness = await open();
    expect(panelOf(harness).textContent).toContain('Write the onboarding checklist');

    let fail: (reason: unknown) => void = (): void => undefined;
    page.mockImplementation(
      (_listId, query, _group, _cursor, _limit, _signal, due): Promise<ListTaskPage> => {
        if (due || query.search !== 'quota')
          return answer(sprintTasks)(_listId, query, _group, _cursor, _limit, _signal, due);
        return new Promise<ListTaskPage>((_resolve, reject) => {
          fail = reject;
        });
      },
    );
    const view: InstanceType<typeof ListViewStore> = required(
      harness.routeDebugElement,
    ).injector.get(ListViewStore);
    view.setSearch('quota');
    await expect
      .poll(() => {
        harness.detectChanges();
        return panelOf(harness).querySelector('[aria-busy="true"]');
      })
      .not.toBeNull();
    expect(panelOf(harness).textContent).not.toContain('Write the onboarding checklist');

    fail(new Error('unavailable'));
    await settle(harness);
    const panel: HTMLElement = panelOf(harness);
    expect(panel.querySelector('[role="alert"]')?.textContent).toContain(
      'The tasks without a due date could not be loaded.',
    );
    expect(panel.textContent).not.toContain('Write the onboarding checklist');
    expect(panel.textContent).not.toContain('All tasks have a due date.');
    expect(panel.querySelector('h2 span')).toBeNull();

    page.mockImplementation(answer(sprintTasks));
    const calls: number = page.mock.calls.length;
    required(
      [...panel.querySelectorAll<HTMLButtonElement>('button')].find(
        (button: HTMLButtonElement): boolean => button.textContent.trim() === 'Retry',
      ),
    ).click();
    await settle(harness);

    expect(page.mock.calls.length).toBeGreaterThan(calls);
    expect(panelOf(harness).querySelector('[role="alert"]')).toBeNull();
    expect(panelOf(harness).textContent).toContain('Write the onboarding checklist');
  });

  it('says the list has no task when the read answers empty', async () => {
    page.mockImplementation(answer([]));
    const harness: RouterTestingHarness = await open();

    expect(panelOf(harness).textContent).toContain('No task');
    expect(panelOf(harness).textContent).not.toContain('All tasks have a due date.');
    expect(hostOf(harness).querySelector('[role="grid"]')).not.toBeNull();
  });

  it('says undated tasks may be missing when the unwindowed read stops at the cap', async () => {
    let served: number = 0;
    page.mockImplementation(
      (_listId, _query, _group, _cursor, _limit, _signal, due): Promise<ListTaskPage> => {
        if (due) return Promise.resolve({ items: [sprintTasks[0]], nextCursor: null, total: 1 });
        const items: TaskSummary[] = Array.from({ length: 100 }, (_: unknown, index: number) =>
          task(`CAD-${String(1000 + served + index)}`, 'Dated task', '2027-03-01'),
        );
        served += items.length;
        return Promise.resolve({ items, nextCursor: `page-${String(served)}`, total: 2500 });
      },
    );
    const harness: RouterTestingHarness = await open();
    await expect
      .poll(() => {
        harness.detectChanges();
        return hostOf(harness).querySelector('[data-testid="calendar-undated-truncated"]');
      })
      .not.toBeNull();

    const panel: HTMLElement = panelOf(harness);
    expect(
      panel.querySelector('[data-testid="calendar-undated-truncated"]')?.textContent.trim(),
    ).toBe(
      'Only the first 2,000 tasks of the list were read: tasks without a due date may be missing.',
    );
    expect(panel.textContent).not.toContain('All tasks have a due date.');
  });

  it('opens the task menu on a task of the +N others popover', async () => {
    page.mockImplementation(
      answer([
        task('CAD-482', 'Redesign the SSO sign-in screen', '2026-11-27'),
        task('CAD-483', 'Organization quotas page', '2026-11-27'),
        task('CAD-484', 'Invite flow copy', '2026-11-27'),
        task('CAD-485', 'Audit log export', '2026-11-27'),
      ]),
    );
    const harness: RouterTestingHarness = await open();
    const more: HTMLButtonElement = required(
      hostOf(harness).querySelector<HTMLButtonElement>('[data-more]'),
    );
    more.click();
    await settle(harness);
    const row: HTMLElement = required(
      [...document.querySelectorAll<HTMLElement>('[data-calendar-task="CAD-485"]')]
        .find((element: HTMLElement): boolean => !hostOf(harness).contains(element))
        ?.closest<HTMLElement>('button'),
    );

    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }),
    );
    await settle(harness);

    expect(menuItem('Status')).toBeDefined();
    expect(document.body.textContent).toContain('CAD-485');
    expect(menuItem('New task on that day')).toBeUndefined();
  });

  it('renders the route boundary on a failed first read, and reads again on Retry', async () => {
    page.mockImplementationOnce(() => Promise.reject(new UnavailableRouteError(503, 'req-7')));
    page.mockImplementationOnce(() => Promise.reject(new UnavailableRouteError(503, 'req-7')));

    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/l/sprint-14/calendar');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent.trim();
      })
      .toBe('unavailable');

    await harness.navigateByUrl('/l/sprint-14/calendar');
    await settle(harness);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-calendar-task="CAD-482"]') ?? null;
      })
      .not.toBeNull();
  });
});
