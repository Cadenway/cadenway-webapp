import { Component, input, type InputSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { provideCwStatusLabels } from '@cadenway/ui/components/status-icon';
import { CwToastService } from '@cadenway/ui/components/toast';
import { provideCwLocale } from '@cadenway/ui/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import { TaskActionsApi, type TaskSummary } from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { isRouteError, UnavailableRouteError } from '@shared/route-errors';

import { statusLabels } from '../../../constants/view-labels/view-labels.constants';
import { ListTasksApi } from '../../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import { GANTT_VIEW_PROVIDERS } from '../../../state/gantt-view/gantt-view.providers';
import { ListTasksStore } from '../../../state/list-tasks/list-tasks.store';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { GanttViewPage } from './gantt-view-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the error boundary: shows the kind of the typed route error it receives.
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
   * The error the router caught.
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
   * The kind of a typed route error, following the `cause` chain; `other` for any other error.
   *
   * @param {unknown} error - The caught error.
   * @returns {string} The kind.
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
 * @param {Partial<TaskSummary>} [changes] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(key: string, name: string, changes: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due: null,
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
    ...changes,
  };
}

/**
 * Constant sprintTasks
 *
 * @description
 * The tasks of Sprint 14: two dated tasks, the sprint review milestone and an undated task.
 *
 * @type {readonly TaskSummary[]}
 */
const sprintTasks: readonly TaskSummary[] = [
  task('CAD-482', 'Redesign the SSO sign-in screen', {
    status: 'progress',
    start: '2026-11-23',
    due: '2026-11-27',
  }),
  task('CAD-483', 'Organization quotas page', { start: '2026-11-30', due: '2026-12-02' }),
  task('CAD-490', 'Sprint 14 review', { milestone: true, due: '2026-12-04' }),
  task('CAD-485', 'Audit log export'),
];

/**
 * Function ready
 *
 * @description
 * A resource that has answered with a value.
 *
 * @param {unknown} value - The value.
 * @returns {object} The resource.
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

describe('GanttViewPage', () => {
  let page: Mock<ListTasksApi['page']>;
  let update: Mock<ListTasksApi['update']>;
  let toasts: Record<string, Mock>;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 10, 26, 10, 30), toFake: ['Date'] });
    page = vi.fn<ListTasksApi['page']>((): Promise<ListTaskPage> =>
      Promise.resolve({ items: sprintTasks, nextCursor: null, total: sprintTasks.length }),
    );
    update = vi.fn<ListTasksApi['update']>(() => Promise.resolve({ kind: 'done', version: 4 }));
    toasts = {
      show: vi.fn(() => 'toast-1'),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      toasts: vi.fn(() => []),
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideCwLocale(() => 'en-US'),
        provideCwStatusLabels(statusLabels),
        provideRouter(
          [
            {
              path: 'l/:listId/gantt',
              providers: [
                ...GANTT_VIEW_PROVIDERS,
                { provide: ListTasksApi, useValue: { page, update } },
              ],
              component: GanttViewPage,
            },
          ],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        ListViewStore,
        {
          provide: ListPageStore,
          useValue: {
            listId: () => 'sprint-14',
            list: ready({ id: 'sprint-14', name: 'Sprint 14', spaceId: 'product', canEdit: true }),
            space: ready({ id: 'product', statuses: [] }),
            organizationMembers: ready([{ userId: 'u-ines', name: 'Inès Robert' }]),
            refreshCounts: vi.fn(),
          },
        },
        {
          provide: SpacesNavigationStore,
          useValue: { spaces: ready([]), overviews: ready({}), openDialog: vi.fn() },
        },
        { provide: TaskActionsApi, useValue: { bulk: vi.fn(), restore: vi.fn(), remind: vi.fn() } },
        { provide: TaskApi, useValue: { changeStatus: vi.fn(() => of()), read: vi.fn() } },
        { provide: CwToastService, useValue: toasts },
        { provide: RealtimeConnection, useValue: { watch: () => of() } },
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

  /**
   * Function open
   *
   * @description
   * Opens the `Gantt` view of Sprint 14 and waits until its skeleton is gone.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/l/sprint-14/gantt');
    await settle(harness);
    return harness;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the view no longer shows its skeleton and its writes have run.
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
    for (let tick: number = 0; tick < 10; tick++) await Promise.resolve();
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
   * Function barOf
   *
   * @description
   * The bar of a task.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} key - The task key.
   * @returns {HTMLElement} The bar.
   */
  function barOf(harness: RouterTestingHarness, key: string): HTMLElement {
    const bar: HTMLElement | null = hostOf(harness).querySelector<HTMLElement>(
      `[role="button"][data-bar-id="${key}"]`,
    );
    if (!bar) throw new Error(`Expected the bar of ${key}.`);
    return bar;
  }

  /**
   * Function titleOf
   *
   * @description
   * The period title, its spaces made plain (the locale's range uses thin spaces).
   *
   * @param {HTMLElement} host - The view.
   * @returns {string} The title.
   */
  function titleOf(host: HTMLElement): string {
    return (host.querySelector('h2')?.textContent ?? '').replace(/\s+/gu, ' ').trim();
  }

  /**
   * Function button
   *
   * @description
   * The button of an accessible name in the document (menus render outside the view).
   *
   * @param {string} name - Its `aria-label` or text.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(name: string): HTMLButtonElement | undefined {
    return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (element: HTMLButtonElement): boolean =>
        (element.getAttribute('aria-label') ?? element.textContent.trim()) === name,
    );
  }

  /**
   * Function key
   *
   * @description
   * Presses a key on an element.
   *
   * @param {HTMLElement} element - The element.
   * @param {string} name - The key.
   * @param {boolean} [shiftKey] - Whether Shift is held.
   */
  function key(
    element: HTMLElement,
    name: string,
    modifiers: { readonly shiftKey?: boolean; readonly altKey?: boolean } = {},
  ): void {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, ...modifiers, bubbles: true, cancelable: true }),
    );
  }

  /**
   * Function rowsOf
   *
   * @description
   * The task rows drawn, with their depth under their parents.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {[string | null, string | null][]} The task keys and depths.
   */
  function rowsOf(harness: RouterTestingHarness): [string | null, string | null][] {
    return [...hostOf(harness).querySelectorAll('[data-task-row]')].map(
      (element: Element): [string | null, string | null] => [
        element.getAttribute('data-task-row'),
        element.getAttribute('data-depth'),
      ],
    );
  }

  it('shows the tasks by status with their key and duration, the milestone line and the period', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    expect(host.querySelector('section')?.getAttribute('aria-label')).toBe('Gantt chart');
    expect(titleOf(host)).toBe('Nov 23 – Dec 13, 2026');
    expect(host.querySelector('[role="treegrid"]')?.getAttribute('aria-label')).toBe(
      'Gantt timeline: Ctrl + wheel or Ctrl +/− to zoom',
    );
    const text: string = host.textContent;
    expect(text).toContain('To do');
    expect(text).toContain('In progress');
    expect(text).toContain('Redesign the SSO sign-in screen');
    expect(text).toContain('CAD-482');
    expect(text).toContain('5 d');
    expect(text).toContain('Duration');
    expect(
      [...host.querySelectorAll('[role="img"]')].map((element: Element) =>
        element.getAttribute('aria-label')?.replace(/\s+/gu, ' '),
      ),
    ).toContain('Milestone Sprint 14 review, Dec 4');
    expect(button('Schedule')).toBeDefined();
    expect(page).toHaveBeenCalledWith(
      'sprint-14',
      expect.objectContaining({ level: 'all' }),
      null,
      null,
      100,
      expect.any(AbortSignal),
      null,
    );
    expect(TestBed.inject(ListViewStore).rows().visibleCount).toBe(4);
  });

  it('shows the empty text after a read without a task', async () => {
    page.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    const harness: RouterTestingHarness = await open();

    expect(hostOf(harness).textContent).toContain('No task matches the search or the filters.');
    expect(hostOf(harness).querySelector('[data-testid="error"]')).toBeNull();
  });

  it('renders the route boundary on a failed read, and reads again on Retry', async () => {
    page.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-7'));

    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/l/sprint-14/gantt');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent.trim();
      })
      .toBe('unavailable');

    await harness.navigateByUrl('/l/sprint-14/gantt');
    await settle(harness);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Redesign the SSO sign-in screen');
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('moves a bar by its due date alone, the gateway moving its start, with its toast', async () => {
    const harness: RouterTestingHarness = await open();

    key(barOf(harness, 'CAD-482'), 'ArrowRight');
    await settle(harness);

    expect(update).toHaveBeenCalledWith('CAD-482', 3, { dueDate: '2026-11-28' });
    expect(toasts['show']).toHaveBeenCalledWith(
      'CAD-482 rescheduled',
      expect.objectContaining({ description: 'From November 24 to November 28.' }),
    );
    expect(hostOf(harness).textContent).toContain('5 d');
  });

  it('resizes a bar by the edge that changed, keeping the start of a resized end', async () => {
    const harness: RouterTestingHarness = await open();

    key(barOf(harness, 'CAD-482'), 'ArrowLeft', { altKey: true });
    await settle(harness);
    expect(update).toHaveBeenLastCalledWith('CAD-482', 3, { startDate: '2026-11-22' });

    key(barOf(harness, 'CAD-483'), 'ArrowRight', { shiftKey: true });
    await settle(harness);
    expect(update).toHaveBeenLastCalledWith('CAD-483', 3, {
      startDate: '2026-11-30',
      dueDate: '2026-12-03',
    });
  });

  it('moves a milestone with a start and a task without one by their due date alone', async () => {
    page.mockResolvedValue({
      items: [
        task('CAD-491', 'Release 2.4', { milestone: true, start: '2026-12-01', due: '2026-12-04' }),
        task('CAD-492', 'Write the changelog', { due: '2026-11-27' }),
      ],
      nextCursor: null,
      total: 2,
    });
    const harness: RouterTestingHarness = await open();

    key(barOf(harness, 'CAD-491'), 'ArrowRight');
    await settle(harness);
    expect(update).toHaveBeenLastCalledWith('CAD-491', 3, { dueDate: '2026-12-05' });

    key(barOf(harness, 'CAD-492'), 'ArrowRight');
    await settle(harness);
    expect(update).toHaveBeenLastCalledWith('CAD-492', 3, { dueDate: '2026-11-28' });
    expect(toasts['show']).toHaveBeenLastCalledWith(
      'CAD-492 rescheduled',
      expect.objectContaining({ description: 'On November 28.' }),
    );
  });

  it('keeps a milestone on one day and schedules an undated task over three days', async () => {
    const harness: RouterTestingHarness = await open();

    key(barOf(harness, 'CAD-490'), 'ArrowRight', { shiftKey: true });
    await settle(harness);
    expect(update).toHaveBeenCalledWith('CAD-490', 3, { dueDate: '2026-12-05' });
    expect(toasts['show']).toHaveBeenCalledWith(
      'CAD-490 rescheduled',
      expect.objectContaining({ description: 'On December 5.' }),
    );

    button('Schedule')?.click();
    await settle(harness);
    expect(update).toHaveBeenCalledWith('CAD-485', 3, {
      startDate: '2026-11-26',
      dueDate: '2026-11-28',
    });
  });

  it('opens the task menu from a bar and the chart menu from a group row', async () => {
    const harness: RouterTestingHarness = await open();

    barOf(harness, 'CAD-482').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
    await settle(harness);
    expect(document.body.textContent).toContain('CAD-482 · Redesign the SSO sign-in screen');
    expect(button('Go to today')).toBeUndefined();
    key(document.activeElement as HTMLElement, 'Escape');
    await settle(harness);

    const group: Element | null | undefined = [
      ...hostOf(harness).querySelectorAll('[role="row"][aria-level="1"]'),
    ].find((row: Element) => row.textContent.includes('In progress'));
    group?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await settle(harness);
    expect(button('Go to today')).toBeDefined();
  });

  it('changes the scale and the period, and says when there is nothing to fit', async () => {
    page.mockResolvedValue({ items: [sprintTasks[3]], nextCursor: null, total: 1 });
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    button('Week')?.click();
    harness.detectChanges();
    expect(titleOf(host)).toBe('Nov 9, 2026 – Jan 31, 2027');
    expect(button('Previous period')).toBeDefined();

    button('Next period')?.click();
    harness.detectChanges();
    expect(titleOf(host)).toBe('Dec 7, 2026 – Feb 28, 2027');

    button('Fit')?.click();
    expect(toasts['show']).toHaveBeenCalledWith('Nothing to fit', {
      description: 'No dated task in this list.',
    });
  });

  it('keeps the chart under an inline error when a refresh fails, and reads again on Retry', async () => {
    const harness: RouterTestingHarness = await open();
    page.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-8'));

    harness.routeDebugElement?.injector.get(ListTasksStore).reload();
    await expect
      .poll(() => {
        harness.detectChanges();
        return hostOf(harness).querySelector('[role="alert"]')?.textContent ?? '';
      })
      .toContain('The tasks could not be refreshed.');
    expect(hostOf(harness).textContent).toContain('Redesign the SSO sign-in screen');

    button('Retry')?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return hostOf(harness).querySelector('[role="alert"]');
      })
      .toBeNull();
    expect(page).toHaveBeenCalledTimes(3);
    expect(hostOf(harness).textContent).toContain('Redesign the SSO sign-in screen');
  });

  it('says only the first tasks are shown when the read stops at the cap', async () => {
    let read: number = 0;
    page.mockImplementation((): Promise<ListTaskPage> => {
      const first: number = read * 100;
      read++;
      return Promise.resolve({
        items: Array.from({ length: 100 }, (_: unknown, index: number) =>
          task(`CAD-${String(first + index + 1)}`, `Task ${String(first + index + 1)}`),
        ),
        nextCursor: 'more',
        total: 2500,
      });
    });

    const harness: RouterTestingHarness = await open();
    await expect
      .poll(() => {
        harness.detectChanges();
        return hostOf(harness).querySelector('[role="status"]')?.textContent.trim();
      })
      .toBe('Only the first 2,000 tasks are shown.');
    expect(button('Fit')?.getAttribute('title')).toBe('Fit to the 0 dated tasks shown');

    button('Fit')?.click();
    expect(toasts['show']).toHaveBeenCalledWith('Nothing to fit', {
      description: 'No dated task among the tasks shown.',
    });
  });

  it('reads every level and folds subtasks under their parent until its chevron unfolds them', async () => {
    page.mockResolvedValue({
      items: [
        sprintTasks[0],
        sprintTasks[1],
        task('CAD-486', 'Plan the SSO rollout', {
          parentKey: 'CAD-482',
          status: 'progress',
          start: '2026-11-24',
          due: '2026-11-25',
        }),
        task('CAD-487', 'Sign-off', {
          parentKey: 'CAD-482',
          status: 'progress',
          milestone: true,
          due: '2026-11-26',
        }),
      ],
      nextCursor: null,
      total: 4,
    });

    const harness: RouterTestingHarness = await open();

    expect(page).toHaveBeenCalledWith(
      'sprint-14',
      expect.objectContaining({ level: 'all' }),
      null,
      null,
      100,
      expect.any(AbortSignal),
      null,
    );
    expect(rowsOf(harness)).toEqual([
      ['CAD-483', '0'],
      ['CAD-482', '0'],
    ]);
    const chevron: HTMLButtonElement | undefined = button('Show the 2 subtasks of CAD-482');
    expect(chevron?.getAttribute('aria-expanded')).toBe('false');

    chevron?.click();
    harness.detectChanges();
    expect(rowsOf(harness)).toEqual([
      ['CAD-483', '0'],
      ['CAD-482', '0'],
      ['CAD-486', '1'],
      ['CAD-487', '1'],
    ]);
    expect(button('Hide the 2 subtasks of CAD-482')?.getAttribute('aria-expanded')).toBe('true');
    expect(
      [...hostOf(harness).querySelectorAll('[role="img"]')].map((element: Element) =>
        element.getAttribute('aria-label')?.replace(/\s+/gu, ' '),
      ),
    ).toContain('Milestone Sign-off, Nov 26');
  });

  it('folds and unfolds the subtasks of a parent from its keyboard menu', async () => {
    page.mockResolvedValue({
      items: [
        sprintTasks[0],
        task('CAD-486', 'Plan the SSO rollout', {
          parentKey: 'CAD-482',
          status: 'progress',
          due: '2026-11-25',
        }),
      ],
      nextCursor: null,
      total: 2,
    });
    const harness: RouterTestingHarness = await open();
    const menuItem: (name: string) => HTMLElement | undefined = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (element: HTMLElement): boolean => element.textContent.trim() === name,
      );

    key(barOf(harness, 'CAD-482'), 'F10', { shiftKey: true });
    await settle(harness);
    expect(menuItem('Task actions')).toBeDefined();
    menuItem('Show the 1 subtasks of CAD-482')?.click();
    await settle(harness);

    expect(rowsOf(harness)).toEqual([
      ['CAD-482', '0'],
      ['CAD-486', '1'],
    ]);
    key(barOf(harness, 'CAD-482'), 'F10', { shiftKey: true });
    await settle(harness);
    menuItem('Hide the 1 subtasks of CAD-482')?.click();
    await settle(harness);
    expect(rowsOf(harness)).toEqual([['CAD-482', '0']]);
  });

  it('opens an undated task on Enter and schedules nothing', async () => {
    const harness: RouterTestingHarness = await open();
    const row: Element | null | undefined = hostOf(harness)
      .querySelector('[data-task-row="CAD-485"]')
      ?.closest('[role="row"]');

    row?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await settle(harness);

    await expect.poll(() => TestBed.inject(Router).url).toContain('task=CAD-485');
    expect(update).not.toHaveBeenCalled();
  });

  it('shows every subtask under its parent when the view unfolds them', async () => {
    TestBed.inject(ListViewStore).setSubtasks('expanded');
    page.mockResolvedValue({
      items: [
        task('CAD-482', 'Redesign the SSO sign-in screen', { due: '2026-11-27' }),
        task('CAD-486', 'Plan the SSO rollout', { parentKey: 'CAD-482', due: '2026-11-25' }),
        task('CAD-488', 'Draft the plan', { parentKey: 'CAD-486', due: '2026-11-24' }),
      ],
      nextCursor: null,
      total: 3,
    });

    const harness: RouterTestingHarness = await open();

    expect(rowsOf(harness)).toEqual([
      ['CAD-482', '0'],
      ['CAD-486', '1'],
      ['CAD-488', '2'],
    ]);
    button('Hide the 1 subtasks of CAD-482')?.click();
    harness.detectChanges();
    expect(rowsOf(harness)).toEqual([['CAD-482', '0']]);
  });

  it('draws subtasks as tasks of their own when the view shows them apart', async () => {
    TestBed.inject(ListViewStore).setSubtasks('separate');
    page.mockResolvedValue({
      items: [
        task('CAD-486', 'Plan the SSO rollout', { parentKey: 'CAD-482', due: '2026-11-25' }),
        task('CAD-482', 'Redesign the SSO sign-in screen', { due: '2026-11-27' }),
      ],
      nextCursor: null,
      total: 2,
    });

    const harness: RouterTestingHarness = await open();

    expect(
      [...hostOf(harness).querySelectorAll('[data-task-row]')].map((element: Element) => [
        element.getAttribute('data-task-row'),
        element.getAttribute('data-depth'),
      ]),
    ).toEqual([
      ['CAD-486', '0'],
      ['CAD-482', '0'],
    ]);
  });
});
