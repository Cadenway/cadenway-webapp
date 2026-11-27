import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailOpener, type TaskSummary } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { DashboardApi } from '../../data-access/services/dashboard-api/dashboard-api.service';
import type { TeamDashboard } from '../../models/team-dashboard/team-dashboard.interface';
import { DashboardStore, type DashboardStoreInstance, REFRESH_AUDIT_MS } from './dashboard.store';

/**
 * Constant lateTask
 *
 * @description
 * A late task of Sprint 14, assigned to Camille.
 *
 * @type {TaskSummary}
 */
const lateTask: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Export the sprint report',
  status: 'progress',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u-camille'],
  due: '2026-11-05',
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

/**
 * Function dashboardOf
 *
 * @description
 * Atelier Nord's dashboard on 8 November 2026, with overrides.
 *
 * @param {Partial<TeamDashboard>} overrides - Fields to change.
 * @returns {TeamDashboard} The dashboard.
 */
function dashboardOf(overrides: Partial<TeamDashboard> = {}): TeamDashboard {
  return {
    today: '2026-11-08',
    weeks: 8,
    openCount: 24,
    lateCount: 1,
    blockedCount: 1,
    completedCount: 52,
    byStatus: [{ status: 'todo', count: 9 }],
    overdueTasks: [lateTask],
    assigneeThreshold: 6,
    assignees: [
      { userId: 'u-hugo', openCount: 2 },
      { userId: 'u-camille', openCount: 7 },
      { userId: 'u-ines', openCount: 5 },
      { userId: 'u-gone', openCount: 2 },
    ],
    completions: [{ startsOn: '2026-11-02', week: 45, completed: 3 }],
    ...overrides,
  };
}

/**
 * Interface Deferred
 *
 * @description
 * A promise with its resolve and reject handles, to answer a read when the spec decides.
 */
interface Deferred<T> {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The pending answer.
   *
   * @type {Promise<T>}
   * @readonly
   */
  readonly promise: Promise<T>;

  /**
   * Property resolve
   *
   * @description
   * Answers with a value.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;

  /**
   * Property reject
   *
   * @description
   * Answers with a failure.
   *
   * @type {(error: unknown) => void}
   * @readonly
   */
  readonly reject: (error: unknown) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * A pending answer the spec settles.
 *
 * @returns {Deferred<T>} The promise and its handles.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise: Promise<T> = new Promise<T>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { promise, resolve, reject };
}

describe('DashboardStore', () => {
  let dashboard: Mock;
  let people: Mock;
  let organization: WritableSignal<{ id: string; slug: string }>;
  let closed: Subject<string>;

  beforeEach(() => {
    dashboard = vi.fn(() => Promise.resolve(dashboardOf()));
    people = vi.fn(() =>
      Promise.resolve([
        { id: 'u-camille', name: 'Camille Martin', initials: 'CM', avatar: null },
        { id: 'u-ines', name: 'Inès Roux', initials: 'IR', avatar: null },
        { id: 'u-hugo', name: 'Hugo Dubois', initials: 'HD', avatar: null },
      ]),
    );
    organization = signal({ id: 'org-atelier', slug: 'atelier-nord' });
    closed = new Subject<string>();
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        { provide: DashboardApi, useValue: { dashboard, people } },
        { provide: WORKSPACE_CONTEXT, useValue: { organization } },
        {
          provide: TaskDetailOpener,
          useValue: { closed, changed: new Subject<string>() },
        },
      ],
    });
  });

  it('reads the period on the caller day, then shows the dashboard with its people', async () => {
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);
    expect(store.loading()).toBe(true);

    await expect.poll(() => store.loading()).toBe(false);

    expect(dashboard).toHaveBeenCalledTimes(1);
    const [request, passive]: [Record<string, unknown>, boolean] = dashboard.mock.calls[0] as [
      Record<string, unknown>,
      boolean,
    ];
    expect(request['weeks']).toBe(8);
    expect(request['today']).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(typeof request['timeZone']).toBe('string');
    expect(passive).toBe(false);
    expect(store.lateTasks()).toEqual([lateTask]);
    expect(store.hiddenLate()).toBe(0);
    expect(
      store.workload().map((row) => [row.person.name, row.person.initials, row.count, row.zone]),
    ).toEqual([
      ['Camille Martin', 'CM', 7, 'critical'],
      ['Inès Roux', 'IR', 5, 'high'],
      ['Hugo Dubois', 'HD', 2, 'normal'],
      ['Unknown member', '?', 2, 'normal'],
    ]);
  });

  it('counts the late tasks past the ten the contract returns', async () => {
    dashboard.mockResolvedValue(dashboardOf({ lateCount: 12 }));
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);

    await expect.poll(() => store.hiddenLate()).toBe(11);
  });

  it('keeps the shown period while another loads, then shows it', async () => {
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);
    await expect.poll(() => store.loading()).toBe(false);
    const longer: Deferred<TeamDashboard> = deferred<TeamDashboard>();
    dashboard.mockReturnValueOnce(longer.promise);

    store.follow(12);

    await expect.poll(() => dashboard.mock.calls.length).toBe(2);
    expect((dashboard.mock.calls[1][0] as { weeks: number }).weeks).toBe(12);
    expect(store.stale()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.dashboard()?.weeks).toBe(8);

    longer.resolve(dashboardOf({ weeks: 12, completedCount: 80 }));
    await expect.poll(() => store.dashboard()?.completedCount).toBe(80);
    expect(store.stale()).toBe(false);
  });

  it('throws the failure of a read that has no answer shown', async () => {
    dashboard.mockRejectedValue(new Error('unavailable'));
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);

    await expect
      .poll(() => {
        try {
          store.loading();
          return null;
        } catch (error: unknown) {
          return error;
        }
      })
      .toBeInstanceOf(Error);
  });

  it('keeps the shown dashboard when a background refresh fails', async () => {
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);
    await expect.poll(() => store.loading()).toBe(false);
    dashboard.mockRejectedValueOnce(new Error('unavailable'));

    store.refresh();

    await expect.poll(() => dashboard.mock.calls.length).toBe(2);
    expect(dashboard.mock.calls[1][1]).toBe(true);
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.loading()).toBe(false);
    expect(store.dashboard()?.openCount).toBe(24);
  });

  it('sends a refresh asked while a read runs once that read settles', async () => {
    const first: Deferred<TeamDashboard> = deferred<TeamDashboard>();
    dashboard.mockReturnValueOnce(first.promise);
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);
    await expect.poll(() => dashboard.mock.calls.length).toBe(1);

    store.refresh();
    store.refresh();
    expect(dashboard).toHaveBeenCalledTimes(1);

    first.resolve(dashboardOf());
    await expect.poll(() => dashboard.mock.calls.length).toBe(2);
    expect(dashboard.mock.calls[1][1]).toBe(true);
    await new Promise((resolve) => setTimeout(resolve));
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it('refreshes once after a burst of focus and closed details', async () => {
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);
    await expect.poll(() => store.loading()).toBe(false);

    window.dispatchEvent(new Event('focus'));
    closed.next('CAD-482');
    expect(dashboard).toHaveBeenCalledTimes(1);

    await expect.poll(() => dashboard.mock.calls.length).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_AUDIT_MS));
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it('never shows an answer of the previous organization after a switch', async () => {
    const store: DashboardStoreInstance = TestBed.inject(DashboardStore);
    await expect.poll(() => store.loading()).toBe(false);
    const late: Deferred<TeamDashboard> = deferred<TeamDashboard>();
    dashboard.mockReturnValueOnce(late.promise);
    store.refresh();
    await expect.poll(() => dashboard.mock.calls.length).toBe(2);
    const lumen: Deferred<TeamDashboard> = deferred<TeamDashboard>();
    dashboard.mockReturnValueOnce(lumen.promise);

    organization.set({ id: 'org-lumen', slug: 'lumen' });

    expect(store.dashboard()).toBeNull();
    expect(store.people()).toEqual([]);
    late.resolve(dashboardOf({ openCount: 99 }));
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.dashboard()).toBeNull();
    expect(store.loading()).toBe(true);

    lumen.resolve(dashboardOf({ openCount: 4 }));
    await expect.poll(() => store.dashboard()?.openCount).toBe(4);
  });
});
