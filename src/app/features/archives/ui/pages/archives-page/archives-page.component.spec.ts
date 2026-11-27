import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
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
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors';
import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';
import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import { TaskDetailOpener } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ARCHIVES_ROUTES } from '../../../archives.routes';
import { ArchivesApi } from '../../../data-access/services/archives-api/archives-api.service';
import { ARCHIVES_CONFIRM_DELAYS_MS } from '../../../state/archives/archives-confirm-delays.token';
import type { ArchivedListItem } from '../../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../../models/archived-task/archived-task.interface';
import type { ArchivesRead } from '../../../models/archives-read/archives-read.interface';

/**
 * Constant sprint13
 *
 * @description
 * The mockup's archived `Sprint 13` of the Product space.
 *
 * @type {ArchivedListItem}
 */
const sprint13: ArchivedListItem = {
  id: 'l-sprint13',
  name: 'Sprint 13',
  spaceId: 'sp-product',
  sprint: true,
  taskCount: 14,
  archivedAt: '2026-11-03T09:00:00Z',
  archivedBy: 'u-camille',
  restorable: true,
};

/**
 * Constant campaign
 *
 * @description
 * An archived list of a space the directory does not hold, archived by a former member.
 *
 * @type {ArchivedListItem}
 */
const campaign: ArchivedListItem = {
  id: 'l-campaign',
  name: 'Back-to-school campaign',
  spaceId: 'sp-unknown',
  sprint: false,
  taskCount: 1,
  archivedAt: '2026-10-12T09:00:00Z',
  archivedBy: 'u-former',
  restorable: true,
};

/**
 * Constant cad430
 *
 * @description
 * The mockup's archived task `CAD-430` of `Sprint 14`.
 *
 * @type {ArchivedTaskItem}
 */
const cad430: ArchivedTaskItem = {
  key: 'CAD-430',
  name: 'Old pricing page',
  status: 'done',
  milestone: false,
  listName: 'Sprint 14',
  listArchived: false,
  archivedAt: '2026-11-05T11:30:00Z',
  archivedBy: 'u-hugo',
};

/**
 * Constant product
 *
 * @description
 * The Product space as Spaces' directory holds it.
 *
 * @type {SpaceDirectoryEntry}
 */
const product: SpaceDirectoryEntry = {
  id: 'sp-product',
  name: 'Product',
  icon: null,
  tone: 'text-muted-foreground',
  callerRole: 'edit',
};

/**
 * Function archives
 *
 * @description
 * A read of the archives holding the given lists and tasks.
 *
 * @param {readonly ArchivedListItem[]} lists - The archived lists.
 * @param {readonly ArchivedTaskItem[]} tasks - The archived tasks.
 * @returns {ArchivesRead} The read.
 */
function archives(
  lists: readonly ArchivedListItem[],
  tasks: readonly ArchivedTaskItem[],
): ArchivesRead {
  return { lists, listTotal: lists.length, tasks, taskTotal: tasks.length };
}

/**
 * Component ElsewhereStub
 *
 * @description
 * Another page of the workspace, to leave the archives for.
 */
@Component({ selector: 'cw-elsewhere-stub', template: '' })
class ElsewhereStub {}

describe('ArchivesPage', () => {
  let api: Record<
    'read' | 'memberNames' | 'unarchiveList' | 'unarchiveTask' | 'checkList' | 'checkTask',
    Mock
  >;
  let toasts: { show: Mock; error: Mock; dismiss: Mock };
  let navigation: { refresh: Mock; refreshCounts: Mock };

  beforeEach(() => {
    api = {
      read: vi.fn(() => Promise.resolve(archives([sprint13, campaign], [cad430]))),
      memberNames: vi.fn(() =>
        Promise.resolve(
          new Map<string, string>([
            ['u-camille', 'Camille Martin'],
            ['u-hugo', 'Hugo Dubois'],
          ]),
        ),
      ),
      unarchiveList: vi.fn(() => Promise.resolve()),
      unarchiveTask: vi.fn(() => Promise.resolve()),
      checkList: vi.fn(() => Promise.resolve('archived')),
      checkTask: vi.fn(() => Promise.resolve('archived')),
    };
    toasts = { show: vi.fn(() => 't1'), error: vi.fn(() => 't2'), dismiss: vi.fn() };
    navigation = { refresh: vi.fn(), refreshCounts: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: ':org',
              children: [...ARCHIVES_ROUTES, { path: '', component: ElsewhereStub }],
            },
          ],
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        { provide: ArchivesApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        { provide: NAVIGATION_REFRESH, useValue: navigation },
        { provide: ARCHIVES_CONFIRM_DELAYS_MS, useValue: [1, 1, 1] },
        { provide: SPACE_DIRECTORY, useValue: { spaces: signal([product]) } },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal({ id: 'org-1', slug: 'atelier-nord', name: 'Atelier Nord' }),
            role: computed(() => 'owner' as const),
            can: (): boolean => true,
          },
        },
      ],
    });
    TestBed.inject(OrganizationPin).set('org-1');
  });

  /**
   * Function open
   *
   * @description
   * Opens an address of the archives and renders it.
   *
   * @param {string} url - The address.
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(url: string): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    return harness;
  }

  /**
   * Function root
   *
   * @description
   * The rendered page, after a change detection.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The root element.
   */
  function root(harness: RouterTestingHarness): HTMLElement {
    harness.detectChanges();
    return harness.fixture.nativeElement as HTMLElement;
  }

  /**
   * Function text
   *
   * @description
   * Normalized text of an element by test id.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} id - Test id.
   * @returns {string} Its text, empty when absent.
   */
  function text(harness: RouterTestingHarness, id: string): string {
    return (
      root(harness)
        .querySelector(`[data-testid="${id}"]`)
        ?.textContent.replace(/\s+/gu, ' ')
        .trim() ?? ''
    );
  }

  /**
   * Function metas
   *
   * @description
   * The meta lines of the rows of a tab.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} id - Test id of the tab's rows.
   * @returns {string[]} Their texts, in order.
   */
  function metas(harness: RouterTestingHarness, id: string): string[] {
    return Array.from(
      root(harness).querySelectorAll(`[data-testid="${id}"] [data-testid="archive-meta"]`),
    ).map((meta: Element) => meta.textContent.trim());
  }

  /**
   * Function button
   *
   * @description
   * A button by its accessible name.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} name - Its `aria-label` or text.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(harness: RouterTestingHarness, name: string): HTMLButtonElement | undefined {
    return Array.from(root(harness).querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) =>
        candidate.getAttribute('aria-label') === name ||
        candidate.textContent.replace(/\s+/gu, ' ').trim() === name,
    );
  }

  it('shows the summary, the tab counts and the archived lists with their space and author', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');

    await expect
      .poll(() => text(harness, 'archives-summary'))
      .toBe(
        '2 lists and 1 archived task. Nothing is erased: everything can be restored in one click.',
      );
    const tabs: string[] = Array.from(root(harness).querySelectorAll('[role="tab"]')).map(
      (tab: Element) => tab.textContent.replace(/\s+/gu, ' ').trim(),
    );
    expect(tabs).toEqual(['Lists, 2', 'Tasks, 1']);
    await expect
      .poll(() => metas(harness, 'archives-lists'))
      .toEqual([
        'Product · 14 tasks · archived on Nov 3 by Camille Martin',
        '1 task · archived on Oct 12',
      ]);
    expect(button(harness, 'Restore the list Sprint 13')).toBeDefined();
  });

  it('opens the tasks tab from the address, with the key and the list', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');

    await expect
      .poll(() => metas(harness, 'archives-tasks'))
      .toEqual(['Sprint 14 · archived on Nov 5 by Hugo Dubois']);
    expect(text(harness, 'archives-tasks')).toContain('CAD-430');
    expect(button(harness, 'Restore CAD-430')).toBeDefined();
  });

  it('names an archived list instead of the list of a task', async () => {
    api.read.mockResolvedValue(archives([], [{ ...cad430, listArchived: true }]));
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');

    await expect
      .poll(() => metas(harness, 'archives-tasks'))
      .toEqual(['Archived list · archived on Nov 5 by Hugo Dubois']);
  });

  it('writes the picked tab to the address', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');
    await expect.poll(() => text(harness, 'archives-lists')).toContain('Sprint 13');

    Array.from(root(harness).querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((tab: HTMLElement) => tab.textContent.trim().startsWith('Tasks'))
      ?.click();

    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/archives?tab=tasks');
    await expect.poll(() => text(harness, 'archives-tasks')).toContain('CAD-430');
  });

  it('tells an empty tab from a failed read', async () => {
    api.read.mockResolvedValue(archives([], []));
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');

    await expect.poll(() => text(harness, 'archives-empty')).toContain('No archived list');
    expect(text(harness, 'archives-empty')).toContain(
      'Archive a list or a completed task to lighten the sidebar without losing anything.',
    );
    expect(text(harness, 'archives-summary')).toContain('0 lists and 0 archived tasks.');
  });

  it('shows the rows skeleton while the first read runs', async () => {
    api.read.mockReturnValue(new Promise<ArchivesRead>(() => undefined));
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');

    const loading: Element | null = root(harness).querySelector('[data-testid="archives-loading"]');
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(loading?.getAttribute('aria-label')).toBe('Loading the archives');
    expect(root(harness).querySelector('h1')?.textContent.trim()).toBe('Archives');
  });

  it('renders the unavailable state on a failed first read, and Retry reads again', async () => {
    api.read.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');

    await expect
      .poll(async () => {
        await harness.fixture.whenStable();
        return root(harness).querySelector('h1')?.textContent.trim();
      })
      .toBe('Could not load this page');
    button(harness, 'Retry')?.click();

    await expect.poll(() => api.read.mock.calls.length).toBe(2);
    await expect.poll(() => text(harness, 'archives-lists')).toContain('Sprint 13');
  });

  it('restores a sprint with its toast and removes its row', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');
    await expect.poll(() => button(harness, 'Restore the list Sprint 13')).toBeDefined();
    api.read.mockResolvedValue(archives([campaign], [cad430]));

    button(harness, 'Restore the list Sprint 13')?.click();

    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    expect(toasts.show).toHaveBeenCalledWith('Sprint restored', {
      description: 'Sprint 13 is back in Product.',
    });
    expect(navigation.refresh).toHaveBeenCalledOnce();
    await expect.poll(() => text(harness, 'archives-lists')).not.toContain('Sprint 13');
    expect(text(harness, 'archives-summary')).toContain('1 list and 1 archived task.');
  });

  it('says its space when the directory does not know it', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');
    await expect
      .poll(() => button(harness, 'Restore the list Back-to-school campaign'))
      .toBeDefined();

    button(harness, 'Restore the list Back-to-school campaign')?.click();

    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    expect(toasts.show).toHaveBeenCalledWith('List restored', {
      description: 'Back-to-school campaign is back in its space.',
    });
  });

  it('restores a task with an Open action that opens its detail', async () => {
    const opener: TaskDetailOpener = TestBed.inject(TaskDetailOpener);
    const opening: MockInstance<TaskDetailOpener['open']> = vi
      .spyOn(opener, 'open')
      .mockResolvedValue(true);
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');
    await expect.poll(() => button(harness, 'Restore CAD-430')).toBeDefined();

    button(harness, 'Restore CAD-430')?.click();

    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    const call: [string, { description: string; action: { label: string; run: () => void } }] =
      toasts.show.mock.calls[0] as [
        string,
        { description: string; action: { label: string; run: () => void } },
      ];
    const title: string = call[0];
    const options: { description: string; action: { label: string; run: () => void } } = call[1];
    expect(title).toBe('CAD-430 restored');
    expect(options.description).toBe('Back in its list.');
    expect(options.action.label).toBe('Open');
    options.action.run();
    expect(opening).toHaveBeenCalledWith('CAD-430', {
      key: 'CAD-430',
      name: 'Old pricing page',
      status: 'done',
      milestone: false,
    });
  });

  it('reports a refused restore and keeps the row', async () => {
    api.unarchiveTask.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');
    await expect.poll(() => button(harness, 'Restore CAD-430')).toBeDefined();

    button(harness, 'Restore CAD-430')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('CAD-430 could not be restored', undefined);
    expect(toasts.show).not.toHaveBeenCalled();
    expect(text(harness, 'archives-tasks')).toContain('CAD-430');
  });

  it('keeps Restore pending through an unknown outcome, then shows a neutral notice', async () => {
    api.unarchiveTask.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');
    await expect.poll(() => button(harness, 'Restore CAD-430')).toBeDefined();

    button(harness, 'Restore CAD-430')?.click();

    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    expect(toasts.show).toHaveBeenCalledWith('The restore of CAD-430 could not be confirmed', {
      description: 'The archives were read again: check whether it is back.',
    });
    expect(toasts.error).not.toHaveBeenCalled();
    expect(api.checkTask).toHaveBeenCalledTimes(3);
  });

  it('shows the restored toast once a later read confirms an unknown outcome', async () => {
    api.unarchiveTask.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    api.checkTask.mockResolvedValueOnce('restored');
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');
    await expect.poll(() => button(harness, 'Restore CAD-430')).toBeDefined();
    api.read.mockResolvedValue(archives([sprint13, campaign], []));

    button(harness, 'Restore CAD-430')?.click();

    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    expect(toasts.show.mock.calls[0][0]).toBe('CAD-430 restored');
    await expect.poll(() => text(harness, 'archives-empty')).toContain('No archived task');
  });

  it('keeps a pending Restore focusable, marked busy, and ignores more clicks', async () => {
    let finish: () => void = () => undefined;
    api.unarchiveList.mockReturnValueOnce(
      new Promise<void>((resolve: () => void) => {
        finish = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');
    await expect.poll(() => button(harness, 'Restore the list Sprint 13')).toBeDefined();

    button(harness, 'Restore the list Sprint 13')?.click();
    button(harness, 'Restore the list Sprint 13')?.click();

    const pending: HTMLButtonElement | undefined = button(harness, 'Restore the list Sprint 13');
    expect(pending?.hasAttribute('disabled')).toBe(false);
    expect(pending?.getAttribute('aria-disabled')).toBe('true');
    expect(pending?.getAttribute('aria-busy')).toBe('true');
    expect(api.unarchiveList).toHaveBeenCalledOnce();
    finish();
    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
  });

  it('moves focus to the next Restore before a restored row leaves, then to the panel', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');
    document.body.appendChild(harness.fixture.nativeElement as HTMLElement);
    await expect.poll(() => button(harness, 'Restore the list Sprint 13')).toBeDefined();
    api.read.mockResolvedValue(archives([campaign], [cad430]));

    button(harness, 'Restore the list Sprint 13')?.focus();
    button(harness, 'Restore the list Sprint 13')?.click();

    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Restore the list Back-to-school campaign',
    );

    await expect.poll(() => api.read.mock.calls.length).toBe(2);
    await expect.poll(() => metas(harness, 'archives-lists').length).toBe(1);
    api.read.mockResolvedValue(archives([], [cad430]));
    button(harness, 'Restore the list Back-to-school campaign')?.click();

    await expect.poll(() => toasts.show.mock.calls.length).toBe(2);
    expect(document.activeElement?.getAttribute('data-testid')).toBe('archives-lists-panel');
    await expect.poll(() => text(harness, 'archives-empty')).toContain('No archived list');
    (harness.fixture.nativeElement as HTMLElement).remove();
  });

  it('offers no Restore on a list the caller cannot edit', async () => {
    api.read.mockResolvedValue(archives([{ ...sprint13, restorable: false }, campaign], []));
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');

    await expect.poll(() => text(harness, 'archives-lists')).toContain('Sprint 13');
    expect(button(harness, 'Restore the list Sprint 13')).toBeUndefined();
    expect(button(harness, 'Restore the list Back-to-school campaign')).toBeDefined();
  });

  it('tells a missing edit right with its own toast', async () => {
    api.unarchiveTask.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 403, error: { code: 'access.role-insufficient' } }),
    );
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');
    await expect.poll(() => button(harness, 'Restore CAD-430')).toBeDefined();

    button(harness, 'Restore CAD-430')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('You cannot restore CAD-430', {
      description: 'Restoring takes the edit right on the list.',
    });
  });

  it('says when a tab shows fewer rows than its total', async () => {
    api.read.mockResolvedValue({ ...archives([sprint13, campaign], []), listTotal: 1_204 });
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');

    await expect
      .poll(() => text(harness, 'archives-lists-truncated'))
      .toBe('Only the 2 most recently archived are shown, out of 1204.');
    expect(text(harness, 'archives-summary')).toContain('1204 lists');
  });

  it('shows no toast when the page left while the restore ran, and dismisses its toasts', async () => {
    let finish: () => void = () => undefined;
    api.unarchiveList.mockResolvedValueOnce(undefined).mockReturnValueOnce(
      new Promise<void>((resolve: () => void) => {
        finish = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open('/atelier-nord/archives');
    await expect.poll(() => button(harness, 'Restore the list Sprint 13')).toBeDefined();
    button(harness, 'Restore the list Sprint 13')?.click();
    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    button(harness, 'Restore the list Back-to-school campaign')?.click();

    await harness.navigateByUrl('/atelier-nord');
    finish();

    await expect.poll(() => toasts.dismiss.mock.calls.length).toBe(1);
    expect(toasts.dismiss).toHaveBeenCalledWith('t1');
    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, 20);
    });
    expect(toasts.show).toHaveBeenCalledOnce();
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });

  it('dismisses its toasts on an organization change, and Open stays in its organization', async () => {
    const opener: TaskDetailOpener = TestBed.inject(TaskDetailOpener);
    const opening: MockInstance<TaskDetailOpener['open']> = vi
      .spyOn(opener, 'open')
      .mockResolvedValue(true);
    const harness: RouterTestingHarness = await open('/atelier-nord/archives?tab=tasks');
    await expect.poll(() => button(harness, 'Restore CAD-430')).toBeDefined();
    button(harness, 'Restore CAD-430')?.click();
    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    const options: { action: { run: () => void } } = toasts.show.mock.calls[0][1] as {
      action: { run: () => void };
    };

    TestBed.inject(OrganizationPin).set('org-2');
    options.action.run();

    expect(toasts.dismiss).toHaveBeenCalledWith('t1');
    expect(opening).not.toHaveBeenCalled();
  });
});
