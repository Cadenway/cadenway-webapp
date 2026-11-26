import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TaskQueriesService, TasksService } from '@cadenway/api-client';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';

import { RELEASED_VIEWS } from '../../../constants/released-views/released-views.token';
import { VIEW_LAYOUTS } from '../../../constants/view-layouts/view-layouts.constants';
import { ListsApi } from '../../../data-access/services/lists-api/lists-api.service';
import { SpacesApi } from '../../../data-access/services/spaces-api/spaces-api.service';
import type { SavedView } from '../../../models/saved-view/saved-view.interface';
import { SidebarApi } from '../../../data-access/services/sidebar-api/sidebar-api.service';
import type { SpaceDetails } from '../../../models/space/space.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { SPACES_ROUTES } from '../../../spaces.routes';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { DEFAULT_VIEW_CONFIG } from '../../../utils/list-view-query/list-view-query.util';

/**
 * Constant bugs
 *
 * @description
 * The mockup's `Bugs` list of `Product`.
 *
 * @type {TaskList}
 */
const bugs: TaskList = {
  id: 'l-bugs',
  spaceId: 'sp-product',
  name: 'Bugs',
  icon: 'bug',
  color: 'rouge',
  sprint: null,
  archived: false,
  canEdit: true,
  version: 2,
};

/**
 * Constant product
 *
 * @description
 * The `Product` space.
 *
 * @type {SpaceDetails}
 */
const product: SpaceDetails = {
  id: 'sp-product',
  name: 'Product',
  prefix: 'CAD',
  canEdit: true,
  canManage: true,
  version: 3,
  description: null,
  icon: 'rocket',
  color: 'violet',
  private: false,
  statuses: [
    { key: 'todo', name: null, hidden: false },
    { key: 'progress', name: null, hidden: false },
    { key: 'triage', name: null, hidden: true },
  ],
};

/**
 * Constant criticalBugs
 *
 * @description
 * The mockup's saved view of `Bugs`.
 *
 * @type {SavedView}
 */
const criticalBugs: SavedView = {
  id: 'sv-bugs',
  listId: 'l-bugs',
  name: 'Critical bugs',
  icon: 'bug',
  layout: 'list',
  config: {
    ...DEFAULT_VIEW_CONFIG,
    filters: { ...DEFAULT_VIEW_CONFIG.filters, priority: ['urgente', 'haute'] },
    sort: { field: 'dueDate', direction: 'asc' },
  },
  version: 1,
};

describe('ListPage', () => {
  let api: Record<string, Mock>;
  let spaceRead: Mock;
  let spaces: Mock;
  let can: Mock;

  beforeEach(() => {
    api = {
      list: vi.fn(() => Promise.resolve(bugs)),
      counts: vi.fn(() =>
        Promise.resolve({
          list: bugs,
          counts: { total: 3, open: 3, done: 0, cancelled: 0, late: 1 },
        }),
      ),
      milestoneCount: vi.fn(() => Promise.resolve(0)),
      listMembers: vi.fn(() =>
        Promise.resolve({ items: [{ userId: 'u1', name: 'Inès Robert' }], total: 1 }),
      ),
      organizationMembers: vi.fn(() => Promise.resolve([{ userId: 'u1', name: 'Inès Robert' }])),
      labels: vi.fn(() => Promise.resolve(['Bug', 'Front'])),
      savedViews: vi.fn(() => Promise.resolve([criticalBugs])),
      remove: vi.fn(() => Promise.resolve(undefined)),
      duplicate: vi.fn(() =>
        Promise.resolve({ list: { ...bugs, name: 'Bugs (copy)' }, taskCount: 3 }),
      ),
      archive: vi.fn(() => Promise.reject(new Error('access.role-insufficient'))),
      createSavedView: vi.fn(),
      deleteSavedView: vi.fn(() => Promise.resolve(undefined)),
    };
    spaceRead = vi.fn(() => Promise.resolve(product));
    spaces = vi.fn(() => Promise.resolve([product]));
    can = vi.fn(() => false);
    TestBed.configureTestingModule({
      providers: [
        { provide: RELEASED_VIEWS, useValue: { layouts: ['list'], dialogs: [] } },
        provideCadenwayIcons(),
        provideRouter(
          [{ path: ':org', children: SPACES_ROUTES }],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        SpacesNavigationStore,
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: () => ({ id: 'org-1', slug: 'atelier-nord' }),
            user: () => ({ id: 'u1' }),
            can,
          },
        },
        { provide: ListsApi, useValue: api },
        {
          provide: SidebarApi,
          useValue: {
            seats: vi.fn(() => Promise.resolve({ plan: 'team', free: 7 })),
            trashCount: vi.fn(() => Promise.resolve(0)),
            archiveCount: vi.fn(() => Promise.resolve(0)),
          },
        },
        {
          provide: TaskQueriesService,
          useValue: {
            countTaskGroups: vi.fn(() =>
              of({
                items: [{ value: 'todo', count: 0 }],
                nextCursor: null,
                total: 0,
                groupBy: 'status',
              }),
            ),
            queryListTasks: vi.fn(() => of({ items: [], nextCursor: null, total: 0 })),
          },
        },
        { provide: TasksService, useValue: {} },
        {
          provide: SpacesApi,
          useValue: {
            space: spaceRead,
            spaces,
            overview: vi.fn(() =>
              Promise.resolve({ spaceId: 'sp-product', taskCount: 3, lists: [] }),
            ),
            favorites: vi.fn(() => Promise.resolve([])),
          },
        },
      ],
    });
  });

  /**
   * Function open
   *
   * @description
   * Opens a list address and waits for its header.
   *
   * @param {string} url - Address below the slug.
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(url: string): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(url);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-testid="list-description"]');
      })
      .toBeTruthy();
    return harness;
  }

  /**
   * Function find
   *
   * @description
   * The element of a test id in the document (overlays render outside the page).
   *
   * @param {string} id - Test id.
   * @returns {HTMLElement | null} The element.
   */
  function find(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }

  it('redirects to the list view and shows the header, the tabs and the tools', async () => {
    await open('/atelier-nord/l/l-bugs');

    await expect.poll(() => find('list-breadcrumb-space')?.textContent ?? '').toContain('Product');
    expect(find('list-description')?.textContent).toContain('3 tasks');
    expect(find('list-description')?.textContent).toContain('0% done');
    expect(find('list-rows')).not.toBeNull();
    expect(find('view-tabs')?.textContent).toContain('List');
    expect(find('view-group')?.textContent).toContain('Group: status');
    expect(find('view-chips')?.textContent).toContain('No filter');
  });

  it('opens the filters with the space statuses and the labels, then shows a chip', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    find('view-filter')?.click();
    harness.detectChanges();
    await expect.poll(() => find('view-filter-dialog')).not.toBeNull();

    const dialog: HTMLElement | null = find('view-filter-dialog');
    expect(dialog?.textContent).toContain('To do');
    expect(dialog?.textContent).not.toContain('To triage');
    expect(dialog?.textContent).toContain('Me');
    expect(dialog?.textContent).toContain('Unassigned');
    expect(dialog?.textContent).not.toContain('Inès Robert');
    expect(dialog?.textContent).toContain('Front');
    expect(dialog?.textContent).toContain('0 of 3 tasks');

    dialog?.querySelector<HTMLButtonElement>('[role="checkbox"]')?.click();
    harness.detectChanges();
    await expect.poll(() => find('view-chip')?.textContent ?? '').toContain('Status');
    expect(find('view-filter')?.textContent).toContain('1');
  });

  it('hides the subtasks menu once the rows read have no subtask', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-subtasks');
      })
      .toBeNull();
    expect(find('view-group')).not.toBeNull();
  });

  it('applies the saved view of the address and marks it modified', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs?savedView=sv-bugs');
    await expect.poll(() => find('view-chip')?.textContent ?? '').toContain('Urgent, High');
    expect(find('saved-view-tab')?.getAttribute('aria-selected')).toBe('true');
    expect(find('view-sort')?.textContent).toContain('Sort: due date');

    find('view-chip')?.querySelector<HTMLButtonElement>('button')?.click();
    harness.detectChanges();
    await expect.poll(() => find('view-modified')).not.toBeNull();
  });

  it('clears a missing saved view with replaceUrl and restores the standard list', async () => {
    const router: Router = TestBed.inject(Router);
    const navigate: MockInstance<Router['navigate']> = vi.spyOn(router, 'navigate');
    const info: MockInstance<CwToastService['info']> = vi.spyOn(
      TestBed.inject(CwToastService),
      'info',
    );
    const harness: RouterTestingHarness = await open(
      '/atelier-nord/l/l-bugs/list?savedView=deleted&keep=yes#section',
    );
    await expect
      .poll(() => {
        harness.detectChanges();
        return router.url;
      })
      .toBe('/atelier-nord/l/l-bugs/list?keep=yes#section');
    expect(find('view-filter')).not.toBeNull();
    expect(find('list-rows')).not.toBeNull();
    expect(info).toHaveBeenCalledExactlyOnceWith('This view no longer exists');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ replaceUrl: true, queryParams: { savedView: null } }),
    );
  });

  it('does not report a missing view when the user deletes the applied view', async () => {
    const info: MockInstance<CwToastService['info']> = vi.spyOn(
      TestBed.inject(CwToastService),
      'info',
    );
    const harness: RouterTestingHarness = await open(
      '/atelier-nord/l/l-bugs/list?savedView=sv-bugs',
    );
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('saved-view-options');
      })
      .not.toBeNull();
    find('saved-view-options')?.click();
    harness.detectChanges();
    await expect.poll(() => find('saved-view-delete')).not.toBeNull();
    find('saved-view-delete')?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return api['deleteSavedView'].mock.calls.length;
      })
      .toBe(1);
    expect(TestBed.inject(Router).url).not.toContain('savedView=');
    expect(info).not.toHaveBeenCalled();
  });

  it('disables saving while saved views load or fail, and enables it after retry', async () => {
    let rejectViews: (reason: unknown) => void = () => undefined;
    api['savedViews'].mockReturnValueOnce(
      new Promise<readonly SavedView[]>((_resolve, reject) => {
        rejectViews = reject;
      }),
    );
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    find('view-group')?.click();
    harness.detectChanges();
    const priority: HTMLButtonElement | undefined = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    ].find((item) => item.textContent.includes('Priority'));
    priority?.click();
    harness.detectChanges();
    await expect.poll(() => find('view-save')).not.toBeNull();
    expect(find('view-save')?.hasAttribute('disabled')).toBe(true);
    rejectViews(new Error('unavailable'));
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Saved views could not be loaded');
    expect(find('view-save')?.hasAttribute('disabled')).toBe(true);
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent.includes('Retry'))
      ?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-save')?.hasAttribute('disabled');
      })
      .toBe(false);
    expect(api['savedViews']).toHaveBeenCalledTimes(2);
  });

  it('resolves a saved assignee id to the member name', async () => {
    api['savedViews'].mockResolvedValueOnce([
      {
        ...criticalBugs,
        config: {
          ...criticalBugs.config,
          filters: { ...criticalBugs.config.filters, assignee: ['u1'] },
        },
      },
    ]);
    await open('/atelier-nord/l/l-bugs?savedView=sv-bugs');
    await expect.poll(() => find('view-chips')?.textContent).toContain('Inès Robert');
  });

  it('retries a failed primary list read through the route boundary', async () => {
    api['list'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness =
      await RouterTestingHarness.create('/atelier-nord/l/l-bugs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Retry');
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Retry'))
      ?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return api['list'].mock.calls.length;
      })
      .toBe(2);
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('list-description');
      })
      .not.toBeNull();
  });

  it('says the tasks could not be loaded below the list header when the rows read fails', async () => {
    const queries: { countTaskGroups: Mock } = TestBed.inject(TaskQueriesService) as unknown as {
      countTaskGroups: Mock;
    };
    queries.countTaskGroups.mockReturnValueOnce(throwError(() => new Error('unavailable')));
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');

    await expect
      .poll(() => {
        harness.detectChanges();
        return document.querySelector('cw-route-error-boundary h1')?.textContent.trim();
      })
      .toBe('Could not load the tasks');
    expect(find('list-description')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Retry');
    expect(harness.routeNativeElement?.textContent).not.toContain('Service status');
  });

  it('keeps saved filters and actions unavailable until a failed read is retried', async () => {
    api['savedViews'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs?savedView=sv-bugs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Saved views could not be loaded');
    expect(find('view-filter')).toBeNull();
    expect(find('list-rows')).toBeNull();
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-export')).not.toBeNull();
    expect(find('list-export')?.getAttribute('aria-disabled')).toBe('true');
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Retry'))
      ?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-chip')?.textContent;
      })
      .toContain('Urgent, High');
    expect(api['savedViews']).toHaveBeenCalledTimes(2);
  });

  it('retries a failed breadcrumb space read', async () => {
    spaceRead.mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('The space could not be loaded');
    const alert: Element | undefined = [
      ...(harness.routeNativeElement?.querySelectorAll('[role="alert"]') ?? []),
    ].find((item: Element) => item.textContent.includes('The space could not be loaded'));
    alert?.querySelector<HTMLButtonElement>('button')?.click();
    await expect.poll(() => spaceRead.mock.calls.length).toBe(2);
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('list-breadcrumb-space')?.textContent;
      })
      .toContain('Product');
  });

  it('retries failed secondary reads instead of treating them as empty', async () => {
    api['labels'].mockRejectedValueOnce(new Error('unavailable'));
    api['organizationMembers'].mockRejectedValueOnce(new Error('unavailable'));
    api['counts'].mockRejectedValueOnce(new Error('unavailable'));
    api['listMembers'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness =
      await RouterTestingHarness.create('/atelier-nord/l/l-bugs');
    for (const message of [
      'The labels could not be loaded',
      'The members could not be loaded.',
      'The counts could not be loaded',
      'The list members could not be loaded',
    ]) {
      await expect
        .poll(() => {
          harness.detectChanges();
          return harness.routeNativeElement?.textContent;
        })
        .toContain(message);
      const alert: Element | undefined = [
        ...(harness.routeNativeElement?.querySelectorAll('[role="alert"]') ?? []),
      ].find((element: Element) => element.textContent.includes(message));
      alert?.querySelector<HTMLButtonElement>('button')?.click();
    }
    await expect.poll(() => api['labels'].mock.calls.length).toBe(2);
    await expect.poll(() => api['organizationMembers'].mock.calls.length).toBe(2);
    await expect.poll(() => api['counts'].mock.calls.length).toBe(2);
    await expect.poll(() => api['listMembers'].mock.calls.length).toBe(2);
  });

  it('deletes the list only once its name is typed', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-delete')).not.toBeNull();
    find('list-delete')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-delete-confirm')).not.toBeNull();

    find('list-delete-confirm')?.click();
    expect(api['remove']).not.toHaveBeenCalled();

    const field: HTMLInputElement | null = document.querySelector<HTMLInputElement>(
      '[role="alertdialog"] input',
    );
    if (field) {
      field.value = 'Bugs';
      field.dispatchEvent(new Event('input'));
    }
    harness.detectChanges();
    find('list-delete-confirm')?.click();
    await expect.poll(() => api['remove'].mock.calls.length).toBe(1);
  });

  it('duplicates the list with a toast and reports a refused archive', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    const toasts: CwToastService = TestBed.inject(CwToastService);
    const show: MockInstance<CwToastService['show']> = vi.spyOn(toasts, 'show');
    const error: MockInstance<CwToastService['error']> = vi.spyOn(toasts, 'error');
    const menuItem: (label: string) => HTMLButtonElement | undefined = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) =>
        item.textContent.includes(label),
      );

    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => menuItem('Duplicate with the tasks')).toBeTruthy();
    menuItem('Duplicate with the tasks')?.click();
    await expect.poll(() => show.mock.calls.length).toBe(1);
    expect(show.mock.calls[0]?.[0]).toBe('List duplicated');
    expect(show.mock.calls[0]?.[1]?.description).toBe('Bugs (copy) · 3 tasks');
    show.mock.calls[0]?.[1]?.undo?.();
    await expect.poll(() => api['remove'].mock.calls.length).toBe(1);
    expect(api['remove']).toHaveBeenCalledWith({ ...bugs, name: 'Bugs (copy)' });

    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => menuItem('Archive the list')).toBeTruthy();
    menuItem('Archive the list')?.click();
    await expect.poll(() => error.mock.calls.length).toBe(1);
    expect(error).toHaveBeenCalledWith('The list could not be archived');
  });

  it('falls back to the list view for a layout that is not released, keeping the query', async () => {
    const router: Router = TestBed.inject(Router);
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs/board?keep=yes');
    await expect
      .poll(() => {
        harness.detectChanges();
        return router.url;
      })
      .toBe('/atelier-nord/l/l-bugs/list?keep=yes');
    expect(find('list-rows')).not.toBeNull();
    expect(find('board-view')).toBeNull();
    expect(
      [...document.querySelectorAll('[data-testid="view-tabs"] [role="tab"]')].map((tab) =>
        tab.textContent.trim(),
      ),
    ).toEqual(['List', 'Critical bugs']);
  });

  it('opens a saved view of a layout that is not released on the list view', async () => {
    api['savedViews'].mockResolvedValue([{ ...criticalBugs, layout: 'board' }]);
    const router: Router = TestBed.inject(Router);
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    await expect.poll(() => find('saved-view-tab')).not.toBeNull();
    find('saved-view-tab')?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return router.url;
      })
      .toBe('/atelier-nord/l/l-bugs/list?savedView=sv-bugs');
    await expect.poll(() => find('view-chip')?.textContent ?? '').toContain('Urgent, High');
    expect(find('list-rows')).not.toBeNull();
  });

  it('opens a saved view from the address on its released layout, replacing the address', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list', 'board'], dialogs: [] },
    });
    api['savedViews'].mockResolvedValue([{ ...criticalBugs, layout: 'board' }]);
    const router: Router = TestBed.inject(Router);
    const navigate: MockInstance<Router['navigate']> = vi.spyOn(router, 'navigate');
    const harness: RouterTestingHarness = await open(
      '/atelier-nord/l/l-bugs/list?savedView=sv-bugs&keep=yes#section',
    );
    await expect
      .poll(() => {
        harness.detectChanges();
        return router.url;
      })
      .toBe('/atelier-nord/l/l-bugs/board?savedView=sv-bugs&keep=yes#section');
    expect(navigate).toHaveBeenCalledWith(
      ['board'],
      expect.objectContaining({
        replaceUrl: true,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      }),
    );
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('board-view');
      })
      .not.toBeNull();
    expect(find('saved-view-tab')?.getAttribute('aria-selected')).toBe('true');
    expect(find('view-chip')?.textContent).toContain('Urgent, High');
  });

  it('loads each released view at its segment, with the tools its layout shows', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: VIEW_LAYOUTS, dialogs: [] },
    });
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    const views: readonly [string, string, readonly string[]][] = [
      ['board', 'board-view', ['view-columns', 'view-filter', 'view-search']],
      ['calendar', 'calendar-view', ['view-group', 'view-filter']],
      ['gantt', 'gantt-view', ['view-group', 'view-filter']],
      ['workload', 'workload-view', ['view-group', 'view-filter']],
      ['sheet', 'sheet-view', ['view-group', 'view-filter']],
      ['activity', 'activity-view', []],
      ['timesheet', 'timesheet-view', ['view-filter', 'view-search', 'view-create-task']],
    ];
    const router: Router = TestBed.inject(Router);
    for (const [segment, , tools] of views) {
      await harness.navigateByUrl(`/atelier-nord/l/l-bugs/${segment}`);
      await expect
        .poll(() => {
          harness.detectChanges();
          return router.url;
        })
        .toBe(`/atelier-nord/l/l-bugs/${segment}`);
      expect(find('list-description')).not.toBeNull();
      for (const tool of tools) expect(find(tool), `${segment}: ${tool}`).not.toBeNull();
    }
    expect(find('view-tools')).not.toBeNull();
    expect(find('view-columns')).toBeNull();

    await harness.navigateByUrl('/atelier-nord/l/l-bugs/form');
    harness.detectChanges();
    expect(find('view-tools')).toBeNull();
  }, 30_000);

  it('opens a tab at its segment and marks it selected', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list', 'board', 'table'], dialogs: [] },
    });
    const router: Router = TestBed.inject(Router);
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    const tab: (name: string) => HTMLElement | undefined = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="view-tabs"] [role="tab"]')].find(
        (item: HTMLElement) => item.textContent.trim() === name,
      );
    await expect.poll(() => tab('Sheet')).toBeTruthy();
    expect(tab('Gantt')).toBeUndefined();

    tab('Sheet')?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return router.url;
      })
      .toBe('/atelier-nord/l/l-bugs/sheet');
    await expect
      .poll(() => {
        harness.detectChanges();
        return tab('Sheet')?.getAttribute('aria-selected');
      })
      .toBe('true');
    expect(find('sheet-view')).not.toBeNull();

    tab('Board')?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-columns');
      })
      .not.toBeNull();
    expect(router.url).toBe('/atelier-nord/l/l-bugs/board');
    expect(find('view-group')).toBeNull();
  });

  it('hides the board columns the Columns menu unticks and offers to save them', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list', 'board'], dialogs: [] },
    });
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs/board');
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-columns');
      })
      .not.toBeNull();
    expect(find('view-save')).toBeNull();
    find('view-columns')?.click();
    harness.detectChanges();
    const column: () => HTMLButtonElement | undefined = () =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')].find((item) =>
        item.textContent.includes('In progress'),
      );
    await expect.poll(() => column()).toBeTruthy();
    expect(column()?.getAttribute('aria-checked')).toBe('true');
    expect(
      [...document.querySelectorAll('[role="menuitemcheckbox"]')].map((item) =>
        item.textContent.trim(),
      ),
    ).toEqual(['To do', 'In progress']);
    column()?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-save');
      })
      .not.toBeNull();
    expect(column()?.getAttribute('aria-checked')).toBe('false');
  });

  it('shows no dialog opener while no dialog is released', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, { useValue: { layouts: ['list'], dialogs: [] } });
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    expect(find('list-share')).toBeNull();
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-edit-space')).not.toBeNull();
    expect(find('list-space-statuses')).toBeNull();
    expect(find('list-automations')).toBeNull();
  });

  it('opens the released share dialog host from the header', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list'], dialogs: ['share', 'space-statuses'] },
    });
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    expect(document.querySelector('cw-share-dialog')).toBeNull();
    find('list-share')?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.querySelector('cw-share-dialog');
      })
      .not.toBeNull();
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-space-statuses')).not.toBeNull();
    expect(find('list-automations')).toBeNull();
  });

  it('follows back and forward between released layouts in the tools and the tabs', async () => {
    TestBed.configureTestingModule({ providers: [provideLocationMocks()] });
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list', 'board'], dialogs: [] },
    });
    const router: Router = TestBed.inject(Router);
    const location: Location = TestBed.inject(Location);
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    const selected: () => string | undefined = () =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="view-tabs"] [role="tab"]')]
        .find((item: HTMLElement) => item.getAttribute('aria-selected') === 'true')
        ?.textContent.trim();
    const settle: (url: string, tool: string, tab: string) => Promise<void> = async (
      url: string,
      tool: string,
      tab: string,
    ): Promise<void> => {
      await expect
        .poll(() => {
          harness.detectChanges();
          return router.url;
        })
        .toBe(url);
      await expect
        .poll(() => {
          harness.detectChanges();
          return find(tool) !== null && selected() === tab;
        })
        .toBe(true);
    };
    await settle('/atelier-nord/l/l-bugs/list', 'view-group', 'List');
    router.initialNavigation();

    [...document.querySelectorAll<HTMLElement>('[data-testid="view-tabs"] [role="tab"]')]
      .find((item: HTMLElement) => item.textContent.trim() === 'Board')
      ?.click();
    await settle('/atelier-nord/l/l-bugs/board', 'view-columns', 'Board');
    expect(find('view-group')).toBeNull();

    location.back();
    await settle('/atelier-nord/l/l-bugs/list', 'view-group', 'List');
    expect(find('view-columns')).toBeNull();
    expect(find('list-rows')).not.toBeNull();

    location.forward();
    await settle('/atelier-nord/l/l-bugs/board', 'view-columns', 'Board');
    expect(find('board-view')).not.toBeNull();
  });

  it('saves a hidden column into the applied view, which is then not modified', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list', 'board'], dialogs: [] },
    });
    api['savedViews'].mockResolvedValue([{ ...criticalBugs, layout: 'board' }]);
    api['updateSavedView'] = vi.fn((view: SavedView, change: { config: SavedView['config'] }) =>
      Promise.resolve({ ...view, config: change.config, version: view.version + 1 }),
    );
    const harness: RouterTestingHarness = await open(
      '/atelier-nord/l/l-bugs/board?savedView=sv-bugs',
    );
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-columns');
      })
      .not.toBeNull();
    expect(find('view-modified')).toBeNull();

    find('view-columns')?.click();
    harness.detectChanges();
    const column: () => HTMLButtonElement | undefined = () =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')].find((item) =>
        item.textContent.includes('In progress'),
      );
    await expect.poll(() => column()).toBeTruthy();
    column()?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-save-settings');
      })
      .not.toBeNull();

    find('view-save-settings')?.click();
    await expect.poll(() => api['updateSavedView'].mock.calls.length).toBe(1);
    const change: { config: SavedView['config'] } = api['updateSavedView'].mock.calls[0]?.[1] as {
      config: SavedView['config'];
    };
    expect(change.config.presentation.hiddenBoardStatusKeys).toEqual(['progress']);
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-modified');
      })
      .toBeNull();
    expect(find('view-save')).toBeNull();
  });

  it('disables Space statuses on a space the caller cannot edit and Automations for members', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list'], dialogs: ['space-statuses', 'automations'] },
    });
    spaces.mockResolvedValue([{ ...product, canEdit: false }]);
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    await expect
      .poll(() => TestBed.inject(SpacesNavigationStore).spaceById('sp-product'))
      .toBeTruthy();
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-space-statuses')).not.toBeNull();

    expect(find('list-space-statuses')?.getAttribute('aria-disabled')).toBe('true');
    expect(find('list-automations')?.getAttribute('aria-disabled')).toBe('true');
    expect(can).toHaveBeenCalledWith('admin');
  });

  it('enables Space statuses on an editable space and Automations for admins', async () => {
    TestBed.overrideProvider(RELEASED_VIEWS, {
      useValue: { layouts: ['list'], dialogs: ['space-statuses', 'automations'] },
    });
    can.mockReturnValue(true);
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    await expect
      .poll(() => TestBed.inject(SpacesNavigationStore).spaceById('sp-product'))
      .toBeTruthy();
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-space-statuses')).not.toBeNull();

    expect(find('list-space-statuses')?.getAttribute('aria-disabled')).not.toBe('true');
    expect(find('list-automations')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('opens the list dialog from the list icon and the space dialog from the menu', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    const edit: HTMLButtonElement | null = harness.routeNativeElement?.querySelector(
      '[data-testid="list-edit"]',
    ) as HTMLButtonElement | null;

    expect(edit?.getAttribute('aria-label')).toBe('Edit the list');
    edit?.click();
    expect(navigation.dialog()).toEqual({
      kind: 'list',
      spaceId: 'sp-product',
      list: bugs,
      sprint: false,
    });

    await expect.poll(() => navigation.spaceById('sp-product')).toBeTruthy();
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-edit-space')).not.toBeNull();
    find('list-edit-space')?.click();
    expect(navigation.dialog()).toEqual({ kind: 'space', space: product });
  });
});
