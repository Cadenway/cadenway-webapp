import { signal } from '@angular/core';
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
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';
import { LIST_DIRECTORY } from '@features/spaces/ports/list-directory';
import { TaskDetailOpener, type TaskSummary } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { DASHBOARDS_ROUTES } from '../../../dashboards.routes';
import { DashboardApi } from '../../../data-access/services/dashboard-api/dashboard-api.service';
import type { TeamDashboard } from '../../../models/team-dashboard/team-dashboard.interface';

/**
 * Function lateTask
 *
 * @description
 * A late task of Sprint 14.
 *
 * @param {string} key - Its key.
 * @param {string} name - Its name.
 * @returns {TaskSummary} The task.
 */
function lateTask(key: string, name: string): TaskSummary {
  return {
    id: key,
    key,
    name,
    status: 'progress',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u-camille', 'u-hugo'],
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
}

/**
 * Function dashboardOf
 *
 * @description
 * Atelier Nord's dashboard on Sunday 8 November 2026 (`App.dc.html` lines 6667-6704), with
 * overrides.
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
    byStatus: [
      { status: 'todo', count: 9 },
      { status: 'progress', count: 6 },
      { status: 'blocked', count: 1 },
    ],
    overdueTasks: [lateTask('CAD-482', 'Export the sprint report')],
    assigneeThreshold: 6,
    assignees: [
      { userId: 'u-camille', openCount: 7 },
      { userId: 'u-hugo', openCount: 2 },
    ],
    completions: [
      { startsOn: '2026-09-14', week: 38, completed: 6 },
      { startsOn: '2026-09-21', week: 39, completed: 8 },
      { startsOn: '2026-09-28', week: 40, completed: 5 },
      { startsOn: '2026-10-05', week: 41, completed: 8 },
      { startsOn: '2026-10-12', week: 42, completed: 6 },
      { startsOn: '2026-10-19', week: 43, completed: 9 },
      { startsOn: '2026-10-26', week: 44, completed: 7 },
      { startsOn: '2026-11-02', week: 45, completed: 3 },
    ],
    ...overrides,
  };
}

describe('DashboardPage', () => {
  let dashboard: Mock;

  beforeEach(() => {
    dashboard = vi.fn(() => Promise.resolve(dashboardOf()));
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [{ path: ':org', children: DASHBOARDS_ROUTES }],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
          withRouterConfig({ paramsInheritanceStrategy: 'always', onSameUrlNavigation: 'reload' }),
        ),
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: () => ({ id: 'org-atelier', slug: 'atelier-nord' }),
            user: () => ({ id: 'u-camille', name: 'Camille Martin' }),
          },
        },
        {
          provide: LIST_DIRECTORY,
          useValue: {
            lists: signal([
              {
                id: 'sprint-14',
                name: 'Sprint 14',
                spaceId: 'product',
                spaceName: 'Product',
                icon: 'phosphorListBulletsBold',
                tone: 'text-muted-foreground',
              },
            ]),
          },
        },
        {
          provide: DashboardApi,
          useValue: {
            dashboard,
            people: vi.fn(() =>
              Promise.resolve([
                { id: 'u-camille', name: 'Camille Martin', initials: 'CM', avatar: null },
                { id: 'u-hugo', name: 'Hugo Dubois', initials: 'HD', avatar: null },
              ]),
            ),
          },
        },
      ],
    });
  });

  /**
   * Function page
   *
   * @description
   * The routed page element after a change detection.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The page.
   */
  function page(harness: RouterTestingHarness): HTMLElement {
    harness.detectChanges();
    return harness.fixture.nativeElement as HTMLElement;
  }

  /**
   * Function text
   *
   * @description
   * Text of the elements with a test id, joined.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} id - Test id.
   * @returns {string} Their text, empty when absent.
   */
  function text(harness: RouterTestingHarness, id: string): string {
    return [...page(harness).querySelectorAll(`[data-testid="${id}"]`)]
      .map((element: Element) => element.textContent.replace(/\s+/gu, ' ').trim())
      .join(' | ');
  }

  it('shows the skeleton under the title, then the figures of the period', async () => {
    let answer: (value: TeamDashboard) => void = () => undefined;
    dashboard.mockReturnValueOnce(
      new Promise<TeamDashboard>((resolve: (value: TeamDashboard) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/dashboards',
    );
    expect(page(harness).querySelector('h1')?.textContent.trim()).toBe('Team dashboard');
    expect(
      page(harness).querySelector('[data-testid="dashboard-skeleton"]')?.getAttribute('aria-label'),
    ).toBe('Loading the dashboard');

    answer(dashboardOf());

    await expect.poll(() => text(harness, 'dashboard-stats')).toContain('Open tasks');
    expect((dashboard.mock.calls[0][0] as { weeks: number }).weeks).toBe(8);
    expect(text(harness, 'dashboard-subtitle')).toBe('All spaces · data as of Sunday, November 8');
    const stats: string = text(harness, 'dashboard-stats');
    for (const figure of ['24', 'all spaces', '52', 'last 8 weeks', 'Late', 'past due', 'Blocked'])
      expect(stats).toContain(figure);
    expect(page(harness).querySelector('cw-chart [role="img"]')?.getAttribute('aria-label')).toBe(
      'Tasks completed per week, last 8 weeks: 6, 8, 5, 8, 6, 9, 7, 3',
    );
    expect(text(harness, 'workload-row')).toBe(
      'CMCamille Martin7 / 6 Overloaded | HDHugo Dubois2 / 6',
    );
    expect(text(harness, 'status-line')).toBe('To do9 | In progress6 | Blocked1');
    const late: string = text(harness, 'late-task');
    expect(late).toContain('Export the sprint report');
    expect(late).toContain('Sprint 14');
    expect(late).toContain('Camille Martin, Hugo Dubois');
    expect(page(harness).querySelector('[data-testid="late-more"]')).toBeNull();
  });

  it('swaps the chart for a table of the same weeks', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/dashboards',
    );
    await expect.poll(() => text(harness, 'completion-view')).toBe('Show the table');

    page(harness).querySelector<HTMLButtonElement>('[data-testid="completion-view"]')?.click();

    await expect.poll(() => text(harness, 'completion-view')).toBe('Show the chart');
    const rows: string[] = [
      ...page(harness).querySelectorAll('[data-testid="completion-table"] tr'),
    ].map((row: Element) =>
      [...row.children].map((cell: Element) => cell.textContent.trim()).join(' '),
    );
    expect(rows[0]).toBe('Week Completed');
    expect(rows.slice(1)).toEqual([
      'W38 6',
      'W39 8',
      'W40 5',
      'W41 8',
      'W42 6',
      'W43 9',
      'W44 7',
      'W45 3',
    ]);
    expect(page(harness).querySelector('cw-chart')).toBeNull();
  });

  it('says when no task is late, and counts the late tasks past the ten shown', async () => {
    dashboard.mockResolvedValueOnce(dashboardOf({ lateCount: 0, overdueTasks: [] }));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/dashboards',
    );
    await expect.poll(() => text(harness, 'late-empty')).toBe('No late task.');

    dashboard.mockResolvedValueOnce(
      dashboardOf({
        lateCount: 12,
        overdueTasks: Array.from({ length: 10 }, (_: unknown, index: number) =>
          lateTask(`CAD-${String(500 + index)}`, `Late task ${String(index + 1)}`),
        ),
      }),
    );
    TestBed.inject(TaskDetailOpener).notifyChanged('CAD-500');

    await expect.poll(() => text(harness, 'late-more')).toBe('+2 more late tasks');
    expect(page(harness).querySelectorAll('[data-testid="late-task"]')).toHaveLength(10);
  });

  it('shows the unavailable state when the first read fails, and Retry reads again', async () => {
    dashboard.mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/dashboards',
    );
    await expect
      .poll(() => page(harness).querySelector('h1')?.textContent.trim())
      .toBe('Could not load this page');

    const retry: HTMLButtonElement | undefined = [
      ...page(harness).querySelectorAll<HTMLButtonElement>('button'),
    ].find((button: HTMLButtonElement) => button.textContent.trim() === 'Retry');
    retry?.click();

    await expect.poll(() => text(harness, 'dashboard-stats')).toContain('Open tasks');
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it('writes the period into the address and keeps the figures while it loads', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/dashboards',
    );
    await expect.poll(() => text(harness, 'dashboard-stats')).toContain('52');
    let answer: (value: TeamDashboard) => void = () => undefined;
    dashboard.mockReturnValueOnce(
      new Promise<TeamDashboard>((resolve: (value: TeamDashboard) => void) => {
        answer = resolve;
      }),
    );

    [...page(harness).querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab: HTMLButtonElement) => tab.textContent.trim() === '12 weeks')
      ?.click();

    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/dashboards?weeks=12');
    await expect.poll(() => dashboard.mock.calls.length).toBe(2);
    expect((dashboard.mock.calls[1][0] as { weeks: number }).weeks).toBe(12);
    expect(text(harness, 'dashboard-stats')).toContain('52');
    expect(page(harness).querySelector('[data-testid="dashboard-skeleton"]')).toBeNull();

    answer(dashboardOf({ weeks: 12, completedCount: 80 }));
    await expect.poll(() => text(harness, 'dashboard-stats')).toContain('last 12 weeks');
    expect(text(harness, 'dashboard-stats')).toContain('80');
  });

  it('opens the task menu on a late row', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/dashboards',
    );
    await expect.poll(() => text(harness, 'late-task')).toContain('Export the sprint report');

    page(harness)
      .querySelector('[data-testid="late-task"] button')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));

    await expect
      .poll(() => document.body.querySelector('[role="menu"]')?.textContent ?? '')
      .toContain('Copy the identifier');
  });
});
