import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';

import { ListsApi } from '../../../data-access/services/lists-api/lists-api.service';
import { SpacesApi } from '../../../data-access/services/spaces-api/spaces-api.service';
import type { SavedView } from '../../../models/saved-view/saved-view.interface';
import type { Space } from '../../../models/space/space.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { SPACES_ROUTES } from '../../../spaces.routes';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { DEFAULT_VIEW_CONFIG } from '../../../utils/list-view-query/list-view-query.util';

/**
 * Constant bugs
 *
 * @description
 * The mockup's « Bugs » list of « Produit ».
 *
 * @type {TaskList}
 */
const bugs: TaskList = {
  id: 'l-bugs',
  spaceId: 'sp-produit',
  name: 'Bugs',
  icon: 'bug',
  color: 'rouge',
  sprint: null,
  archived: false,
  canEdit: true,
  version: 2,
};

/**
 * Constant produit
 *
 * @description
 * The « Produit » space.
 *
 * @type {Space}
 */
const produit: Space = {
  id: 'sp-produit',
  name: 'Produit',
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
 * Constant bugsCritiques
 *
 * @description
 * The mockup's saved view of « Bugs ».
 *
 * @type {SavedView}
 */
const bugsCritiques: SavedView = {
  id: 'sv-bugs',
  listId: 'l-bugs',
  name: 'Bugs critiques',
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
      savedViews: vi.fn(() => Promise.resolve([bugsCritiques])),
      remove: vi.fn(() => Promise.resolve(undefined)),
      duplicate: vi.fn(() =>
        Promise.resolve({ list: { ...bugs, name: 'Bugs (copie)' }, taskCount: 3 }),
      ),
      archive: vi.fn(() => Promise.reject(new Error('access.role-insufficient'))),
      createSavedView: vi.fn(),
      deleteSavedView: vi.fn(() => Promise.resolve(undefined)),
    };
    spaceRead = vi.fn(() => Promise.resolve(produit));
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [{ path: ':org', children: SPACES_ROUTES }],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        SpacesNavigationStore,
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-1', slug: 'atelier-nord' }) },
        },
        { provide: ListsApi, useValue: api },
        {
          provide: SpacesApi,
          useValue: {
            space: spaceRead,
            spaces: vi.fn(() => Promise.resolve([produit])),
            overview: vi.fn(() =>
              Promise.resolve({ spaceId: 'sp-produit', taskCount: 3, lists: [] }),
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

    await expect.poll(() => find('list-breadcrumb-space')?.textContent ?? '').toContain('Produit');
    expect(find('list-description')?.textContent).toContain('3 tâches');
    expect(find('list-description')?.textContent).toContain('0 % terminé');
    expect(find('list-rows-placeholder')).not.toBeNull();
    expect(find('view-tabs')?.textContent).toContain('Liste');
    expect(find('view-group')?.textContent).toContain('Grouper : statut');
    expect(find('view-chips')?.textContent).toContain('Aucun filtre');
  });

  it('opens the filters with the space statuses and the labels, then shows a chip', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs');
    find('view-filter')?.click();
    harness.detectChanges();
    await expect.poll(() => find('view-filter-dialog')).not.toBeNull();

    const dialog: HTMLElement | null = find('view-filter-dialog');
    expect(dialog?.textContent).toContain('À faire');
    expect(dialog?.textContent).not.toContain('À trier');
    expect(dialog?.textContent).toContain('Moi');
    expect(dialog?.textContent).toContain('Non assigné');
    expect(dialog?.textContent).toContain('Inès Robert');
    expect(dialog?.textContent).toContain('Front');

    dialog?.querySelector<HTMLButtonElement>('[role="checkbox"]')?.click();
    harness.detectChanges();
    await expect.poll(() => find('view-chip')?.textContent ?? '').toContain('Statut');
    expect(find('view-filter')?.textContent).toContain('1');
  });

  it('applies the saved view of the address and marks it modified', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs?savedView=sv-bugs');
    await expect.poll(() => find('view-chip')?.textContent ?? '').toContain('Urgente, Haute');
    expect(find('view-sort')?.textContent).toContain('Tri : échéance');

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
    expect(find('list-rows-placeholder')).not.toBeNull();
    expect(info).toHaveBeenCalledExactlyOnceWith("Cette vue n'existe plus");
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
    ].find((item) => item.textContent.includes('Priorité'));
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
      .toContain('Impossible de charger les vues enregistrées');
    expect(find('view-save')?.hasAttribute('disabled')).toBe(true);
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent.includes('Réessayer'))
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
        ...bugsCritiques,
        config: {
          ...bugsCritiques.config,
          filters: { ...bugsCritiques.config.filters, assignee: ['u1'] },
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
      .toContain('Réessayer');
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Réessayer'))
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

  it('keeps saved filters and actions unavailable until a failed read is retried', async () => {
    api['savedViews'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await open('/atelier-nord/l/l-bugs?savedView=sv-bugs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Impossible de charger les vues enregistrées');
    expect(find('view-filter')).toBeNull();
    expect(find('list-rows-placeholder')).toBeNull();
    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => find('list-export')).not.toBeNull();
    expect(find('list-export')?.getAttribute('aria-disabled')).toBe('true');
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Réessayer'))
      ?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('view-chip')?.textContent;
      })
      .toContain('Urgente, Haute');
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
      .toContain('Impossible de charger l’espace');
    const alert: Element | undefined = [
      ...(harness.routeNativeElement?.querySelectorAll('[role="alert"]') ?? []),
    ].find((item: Element) => item.textContent.includes('Impossible de charger l’espace'));
    alert?.querySelector<HTMLButtonElement>('button')?.click();
    await expect.poll(() => spaceRead.mock.calls.length).toBe(2);
    await expect
      .poll(() => {
        harness.detectChanges();
        return find('list-breadcrumb-space')?.textContent;
      })
      .toContain('Produit');
  });

  it('retries failed secondary reads instead of treating them as empty', async () => {
    api['labels'].mockRejectedValueOnce(new Error('unavailable'));
    api['organizationMembers'].mockRejectedValueOnce(new Error('unavailable'));
    api['counts'].mockRejectedValueOnce(new Error('unavailable'));
    api['listMembers'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness =
      await RouterTestingHarness.create('/atelier-nord/l/l-bugs');
    for (const message of [
      'Impossible de charger les étiquettes',
      'Impossible de charger les membres.',
      'Impossible de charger les comptes',
      'Impossible de charger les membres de la liste',
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
    await expect.poll(() => menuItem('Dupliquer avec les tâches')).toBeTruthy();
    menuItem('Dupliquer avec les tâches')?.click();
    await expect.poll(() => show.mock.calls.length).toBe(1);
    expect(show).toHaveBeenCalledWith('Liste dupliquée', {
      description: 'Bugs (copie) · 3 tâches',
    });

    find('list-more')?.click();
    harness.detectChanges();
    await expect.poll(() => menuItem('Archiver la liste')).toBeTruthy();
    menuItem('Archiver la liste')?.click();
    await expect.poll(() => error.mock.calls.length).toBe(1);
    expect(error).toHaveBeenCalledWith('Impossible d’archiver la liste');
  });
});
