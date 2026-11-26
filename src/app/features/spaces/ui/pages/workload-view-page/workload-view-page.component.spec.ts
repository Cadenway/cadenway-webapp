import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, type InputSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import { TaskActionsApi, type TaskBulkOutcome, type TaskSummary } from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { isRouteError, UnavailableRouteError } from '@shared/route-errors';

import { ListTasksApi } from '../../../data-access/services/list-tasks-api/list-tasks-api.service';
import { WorkloadApi } from '../../../data-access/services/workload-api/workload-api.service';
import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import type { WorkloadSnapshot } from '../../../models/workload/workload.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { WORKLOAD_VIEW_PROVIDERS } from '../../../state/workload-view/workload-view.providers';
import {
  WorkloadViewStore,
  type WorkloadViewStoreInstance,
} from '../../../state/workload-view/workload-view.store';
import { addDays } from '../../../utils/workload/workload.util';
import { WorkloadViewPage } from './workload-view-page.component';

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
 * @param {Partial<TaskSummary>} [changes] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(key: string, changes: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name: key,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due: '2026-11-24',
    start: '2026-11-23',
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
 * Constant cad482
 *
 * @description
 * CAD-482, `Redesign the SSO sign-in screen`, assigned to Camille.
 *
 * @type {TaskSummary}
 */
const cad482: TaskSummary = task('CAD-482', {
  name: 'Redesign the SSO sign-in screen',
  assigneeIds: ['u-camille'],
});

/**
 * Function window
 *
 * @description
 * The workload of two weeks from a Monday: CAD-482, two hours a day for Camille on Monday and
 * Tuesday.
 *
 * @param {string} weekStart - The Monday.
 * @returns {Omit<WorkloadSnapshot, 'key'>} The workload.
 */
function window(weekStart: string): Omit<WorkloadSnapshot, 'key'> {
  return {
    weekStart,
    days: Array.from({ length: 14 }, (_: unknown, index: number) => ({
      date: addDays(weekStart, index),
      totalMinutes: 0,
      capacityMinutes: index % 7 < 5 ? 360 : 0,
    })),
    items: [
      {
        assigneeId: 'u-camille',
        taskKey: 'CAD-482',
        name: 'Redesign the SSO sign-in screen',
        status: 'todo',
        minutesByDay: [120, 120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
  };
}

/**
 * Function ready
 *
 * @description
 * A secondary read of the list frame that has answered.
 *
 * @param {unknown} value - Its value.
 * @returns {object} The read.
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

/**
 * Function applied
 *
 * @description
 * A bulk answer that applied CAD-482 at a version.
 *
 * @param {number} version - The returned version.
 * @returns {TaskBulkOutcome} The answer.
 */
function applied(version: number): TaskBulkOutcome {
  return {
    affected: 1,
    done: [{ taskKey: 'CAD-482', version, newTaskKey: null, trashEntryId: null }],
    failed: [],
    unknown: [],
    notSent: [],
  };
}

describe('WorkloadViewPage', () => {
  let workload: Mock<WorkloadApi['workload']>;
  let spent: Mock<WorkloadApi['spent']>;
  let page: Mock<ListTasksApi['page']>;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let toasts: Record<string, Mock>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 26, 10));
    workload = vi.fn((_listId: string, _query, weekStart: string) =>
      Promise.resolve(window(weekStart)),
    );
    spent = vi.fn(() => Promise.resolve({ 'u-camille': 90 }));
    page = vi.fn((): Promise<ListTaskPage> =>
      Promise.resolve({ items: [cad482], nextCursor: null, total: 1 }),
    );
    bulk = vi.fn<TaskActionsApi['bulk']>(() => Promise.resolve(applied(4)));
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
        provideRouter(
          [
            {
              path: 'l/:listId/workload',
              providers: [ListViewStore, ...WORKLOAD_VIEW_PROVIDERS],
              component: WorkloadViewPage,
            },
          ],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
        ),
        {
          provide: ListPageStore,
          useValue: {
            listId: () => 'sprint-14',
            list: ready({ id: 'sprint-14', name: 'Sprint 14', spaceId: 'product', canEdit: true }),
            space: ready({ id: 'product', statuses: [] }),
            organizationMembers: ready([
              { userId: 'u-ines', name: 'Inès Robert' },
              { userId: 'u-camille', name: 'Camille Martin' },
            ]),
            refreshCounts: vi.fn(),
          },
        },
        {
          provide: SpacesNavigationStore,
          useValue: { spaces: ready([]), overviews: ready({}), openDialog: vi.fn() },
        },
        { provide: WorkloadApi, useValue: { workload, spent } },
        {
          provide: ListTasksApi,
          useValue: { page, groups: vi.fn(), subtasks: vi.fn(), update: vi.fn() },
        },
        { provide: TaskActionsApi, useValue: { bulk, restore: vi.fn(), remind: vi.fn() } },
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
   * Function settle
   *
   * @description
   * Lets the reads answer and the view render them.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    for (let round: number = 0; round < 6; round++) {
      await harness.fixture.whenStable();
      for (let tick: number = 0; tick < 5; tick++) await Promise.resolve();
      harness.detectChanges();
    }
  }

  /**
   * Function open
   *
   * @description
   * Opens the `Workload` view of Sprint 14 and lets it read.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/l/sprint-14/workload');
    await settle(harness);
    return harness;
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
   * Function button
   *
   * @description
   * The button of an accessible name or text in the view.
   *
   * @param {HTMLElement} host - The view.
   * @param {string} name - Its `aria-label` or text.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(host: HTMLElement, name: string): HTMLButtonElement | undefined {
    return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (element: HTMLButtonElement): boolean =>
        (element.getAttribute('aria-label') ?? element.textContent.trim()) === name,
    );
  }

  /**
   * Function rowOf
   *
   * @description
   * The grid row of a person.
   *
   * @param {HTMLElement} host - The view.
   * @param {string} name - The person's name.
   * @returns {HTMLElement | undefined} The row.
   */
  function rowOf(host: HTMLElement, name: string): HTMLElement | undefined {
    return [...host.querySelectorAll<HTMLElement>('tbody [role="row"]')].find(
      (row: HTMLElement): boolean =>
        row.querySelector('[role="rowheader"]')?.textContent.includes(name) ?? false,
    );
  }

  it('shows two weeks of each person, then Unassigned, with chips, totals and time spent', async () => {
    const host: HTMLElement = hostOf(await open());

    expect(host.querySelector('h2')?.textContent.trim()).toBe('Nov 23 – Dec 4, 2026');
    expect(host.querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe(
      'Workload from Monday, November 23 to Friday, December 4, capacity 6 h a day',
    );
    const names: string[] = [...host.querySelectorAll('[role="rowheader"]')].map(
      (header: Element) => header.textContent.trim(),
    );
    expect(names).toHaveLength(3);
    expect(names[0]).toContain('Camille Martin');
    expect(names[1]).toContain('Inès Robert');
    expect(names[2]).toBe('Unassigned');
    const camille: HTMLElement | undefined = rowOf(host, 'Camille Martin');
    expect(camille?.textContent).toContain('CAD-482');
    expect(camille?.textContent).toContain('4 h');
    expect(camille?.textContent).toContain('Spent: 1 h 30');
    expect(camille?.querySelector('[data-testid="workload-chip"]')?.getAttribute('title')).toBe(
      'CAD-482 · Redesign the SSO sign-in screen · 2 h that day · drag to another person to reassign',
    );
    expect(rowOf(host, 'Inès Robert')?.textContent).toContain('No time logged');
    expect(host.textContent).not.toContain('No task matches the search or the filters.');
    expect(host.querySelector('[data-testid="workload-truncated"]')).toBeNull();
  });

  it('says when tasks past the reader cap cannot be reassigned, and why on their chips', async () => {
    page.mockImplementation(
      (_listId: string, _query, _group, cursor: string | null): Promise<ListTaskPage> => {
        const index: number = cursor === null ? 0 : Number(cursor);
        return Promise.resolve({
          items: Array.from({ length: 100 }, (_: unknown, offset: number) =>
            task(`OPS-${String(index * 100 + offset)}`),
          ),
          nextCursor: String(index + 1),
          total: 5000,
        });
      },
    );
    const host: HTMLElement = hostOf(await open());

    expect(host.querySelector('[data-testid="workload-truncated"]')?.textContent.trim()).toBe(
      'Tasks past the first 2,000 cannot be reassigned from this view.',
    );
    expect(
      rowOf(host, 'Camille Martin')
        ?.querySelector('[data-testid="workload-chip"]')
        ?.getAttribute('title'),
    ).toBe(
      'CAD-482 · Redesign the SSO sign-in screen · 2 h that day · past the first 2,000 tasks, it cannot be reassigned from this view',
    );
  });

  it('shows the filter text when no task matches, never a failure', async () => {
    page.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    workload.mockImplementation((_listId, _query, weekStart: string) =>
      Promise.resolve({ ...window(weekStart), items: [] }),
    );
    const host: HTMLElement = hostOf(await open());

    expect(host.textContent).toContain('No task matches the search or the filters.');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[data-testid="error"]')).toBeNull();
  });

  it('hands a failed first read to the error boundary', async () => {
    workload.mockRejectedValue(new UnavailableRouteError(503, 'req-1'));
    const harness: RouterTestingHarness = await open();

    expect(harness.routeNativeElement?.textContent).toContain('unavailable');
  });

  it('keeps the grid when a refresh fails and reads again on Retry', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);
    const store: WorkloadViewStoreInstance | undefined =
      harness.routeDebugElement?.injector.get(WorkloadViewStore);
    workload.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    store?.reload();
    await settle(harness);

    expect(rowOf(host, 'Camille Martin')?.textContent).toContain('CAD-482');
    expect(host.textContent).toContain('The workload could not be refreshed.');
    expect(host.querySelector('[data-testid="error"]')).toBeNull();
    const calls: number = workload.mock.calls.length;
    button(host, 'Retry')?.click();
    await settle(harness);

    expect(workload.mock.calls.length).toBeGreaterThan(calls);
    expect(host.textContent).not.toContain('The workload could not be refreshed.');
  });

  it('shows an inline error with Retry when the time spent cannot be read', async () => {
    spent.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    expect(host.textContent).toContain('The time spent could not be loaded.');
    expect(rowOf(host, 'Camille Martin')?.textContent).toContain('CAD-482');
    button(host, 'Retry')?.click();
    await settle(harness);

    expect(spent).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Spent: 1 h 30');
  });

  it('moves to the next week and back to this week with Today', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    button(host, 'Next week')?.click();
    await settle(harness);

    expect(host.querySelector('h2')?.textContent.trim()).toBe('Nov 30 – Dec 11, 2026');
    expect(workload).toHaveBeenLastCalledWith(
      'sprint-14',
      expect.anything(),
      '2026-11-30',
      expect.any(AbortSignal),
    );
    button(host, 'Today')?.click();
    await settle(harness);
    expect(host.querySelector('h2')?.textContent.trim()).toBe('Nov 23 – Dec 4, 2026');
  });

  it('reassigns a chip dropped on another row, with a toast that offers Undo', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);
    const chip: HTMLElement | null | undefined = rowOf(host, 'Camille Martin')?.querySelector(
      '[data-testid="workload-chip"]',
    );
    const target: HTMLElement | null | undefined = rowOf(host, 'Inès Robert')?.querySelector(
      '[role="gridcell"]',
    );
    expect(chip && target).toBeTruthy();
    const document: Document = host.ownerDocument;
    const elementFromPoint: Mock = vi.fn(() => target);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    });

    chip?.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 10,
        clientY: 10,
        button: 0,
        buttons: 1,
        detail: 1,
      }),
    );
    document.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 60, buttons: 1 }),
    );
    document.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 90, buttons: 1 }),
    );
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 90 }));
    await settle(harness);

    expect(bulk.mock.calls.map((call) => call[1])).toEqual([
      { type: 'assign', userId: 'u-ines' },
      { type: 'unassign', userId: 'u-camille' },
    ]);
    expect(toasts['show']).toHaveBeenCalledWith('CAD-482 reassigned', {
      description: 'From Camille Martin to Inès Robert.',
      undo: expect.any(Function) as unknown,
    });
    expect(rowOf(host, 'Inès Robert')?.textContent).toContain('CAD-482');
    Reflect.deleteProperty(document, 'elementFromPoint');
  });
});
