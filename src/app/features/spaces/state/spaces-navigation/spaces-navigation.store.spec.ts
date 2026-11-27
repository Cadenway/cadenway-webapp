import { signal, type WritableSignal } from '@angular/core';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type CreatedTask, TaskCreate } from '@features/task';

import { HttpErrorResponse } from '@angular/common/http';

import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import { SidebarApi } from '../../data-access/services/sidebar-api/sidebar-api.service';
import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { Favorite } from '../../models/favorite/favorite.interface';
import type { SpaceDetails, SpaceDraft } from '../../models/space/space.interface';
import type {
  ListDraft,
  SpaceOverview,
  TaskList,
} from '../../models/task-list/task-list.interface';
import { todayIso } from '../../utils/calendar-date/calendar-date.util';
import { SpacesNavigationStore } from './spaces-navigation.store';

/**
 * Function space
 *
 * @description
 * A space of Atelier Nord.
 *
 * @param {string} id - Identifier.
 * @param {string} name - Name.
 * @returns {SpaceDetails} The space.
 */
function space(id: string, name: string): SpaceDetails {
  return {
    id,
    name,
    prefix: name.slice(0, 3).toUpperCase(),
    canEdit: true,
    callerRole: 'edit',
    canManage: true,
    version: 3,
    description: null,
    icon: null,
    color: 'gris',
    private: false,
    statuses: [],
  };
}

/**
 * Function draftOf
 *
 * @description
 * The settings of a space as a draft, with a new name.
 *
 * @param {SpaceDetails} source - The space.
 * @param {string} name - The new name.
 * @returns {SpaceDraft} The draft.
 */
function draftOf(source: SpaceDetails, name: string): SpaceDraft {
  return {
    name,
    prefix: source.prefix,
    description: null,
    icon: 'rocket',
    color: 'violet',
    private: false,
  };
}

/**
 * Function list
 *
 * @description
 * A list or, with dates, a sprint.
 *
 * @param {string} id - Identifier.
 * @param {string} spaceId - Space.
 * @param {{ startDate: string; endDate: string } | null} sprint - Sprint dates.
 * @returns {TaskList} The list.
 */
function list(
  id: string,
  spaceId: string,
  sprint: { startDate: string; endDate: string } | null = null,
): TaskList {
  return {
    id,
    spaceId,
    name: id,
    icon: null,
    color: 'gris',
    sprint: sprint ? { ...sprint, goal: null } : null,
    archived: false,
    canEdit: true,
    version: 1,
  };
}

/**
 * Interface SpacesApiFake
 *
 * @description
 * The faked data-access service.
 */
interface SpacesApiFake {
  // #region Properties
  /**
   * Property spaces
   *
   * @description
   * Fake of `spaces`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly spaces: Mock;

  /**
   * Property overview
   *
   * @description
   * Fake of `overview`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly overview: Mock;

  /**
   * Property favorites
   *
   * @description
   * Fake of `favorites`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly favorites: Mock;

  /**
   * Property addFavorite
   *
   * @description
   * Fake of `addFavorite`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly addFavorite: Mock;

  /**
   * Property removeFavorite
   *
   * @description
   * Fake of `removeFavorite`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly removeFavorite: Mock;

  /**
   * Property createSpace
   *
   * @description
   * Fake of `createSpace`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly createSpace: Mock;

  /**
   * Property updateSpace
   *
   * @description
   * Fake of `updateSpace`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly updateSpace: Mock;

  /**
   * Property deleteSpace
   *
   * @description
   * Fake of `deleteSpace`.
   *
   * @type {Mock}
   * @readonly
   */
  readonly deleteSpace: Mock;
  // #endregion
}

describe('SpacesNavigationStore', () => {
  let organization: WritableSignal<{ id: string; slug: string }>;
  let api: SpacesApiFake;
  let store: InstanceType<typeof SpacesNavigationStore>;
  let creations: Subject<CreatedTask>;
  let lists: Record<string, Mock>;
  let sidebar: { readonly seats: Mock; readonly trashCount: Mock; readonly archiveCount: Mock };
  const today: string = todayIso();
  const roadmap: Favorite = {
    id: 'f1',
    kind: 'list',
    targetId: 'l-roadmap',
    name: 'Roadmap',
    listId: null,
  };

  beforeEach(() => {
    organization = signal({ id: 'org-1', slug: 'atelier-nord' });
    creations = new Subject<CreatedTask>();
    api = {
      spaces: vi.fn(() =>
        Promise.resolve([space('sp-product', 'Product'), space('sp-design', 'Design')]),
      ),
      overview: vi.fn((spaceId: string): Promise<SpaceOverview> => {
        if (spaceId === 'sp-design') return Promise.reject(new Error('unavailable'));
        return Promise.resolve({
          spaceId,
          taskCount: 30,
          lists: [
            {
              list: list('l-backlog', spaceId),
              counts: { total: 10, open: 8, done: 2, cancelled: 0, late: 0 },
            },
            {
              list: list('l-sprint14', spaceId, { startDate: today, endDate: today }),
              counts: { total: 20, open: 12, done: 6, cancelled: 2, late: 3 },
            },
          ],
        });
      }),
      favorites: vi.fn(() => Promise.resolve([roadmap])),
      addFavorite: vi.fn(),
      removeFavorite: vi.fn(),
      createSpace: vi.fn(),
      updateSpace: vi.fn(),
      deleteSpace: vi.fn(),
    };
    lists = {
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      unarchive: vi.fn(),
      remove: vi.fn(),
    };
    sidebar = {
      seats: vi.fn(() => Promise.resolve({ plan: 'team', free: 7 })),
      trashCount: vi.fn(() => Promise.resolve(2)),
      archiveCount: vi.fn(() => Promise.resolve(3)),
    };
    TestBed.configureTestingModule({
      providers: [
        SpacesNavigationStore,
        { provide: SpacesApi, useValue: api },
        { provide: ListsApi, useValue: lists },
        { provide: SidebarApi, useValue: sidebar },
        { provide: WORKSPACE_CONTEXT, useValue: { organization } },
        { provide: TaskCreate, useValue: { created: creations.asObservable() } },
      ],
    });
    store = TestBed.inject(SpacesNavigationStore);
  });

  it('reads nothing before following an organization, then the spaces, counts and favorites', async () => {
    TestBed.tick();
    await expect.poll(() => store.overviews.hasValue()).toBe(true);

    expect(store.spaces.value()?.map((item: SpaceDetails) => item.name)).toEqual([
      'Product',
      'Design',
    ]);
    expect(Object.keys(store.overviews.value() ?? {})).toEqual(['sp-product']);
    expect(store.currentSprint()?.list.id).toBe('l-sprint14');
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    expect(store.favoriteOf('list', 'l-roadmap')).toEqual(roadmap);
  });

  it('reads the free seats and the trash and archive counts of the organization', async () => {
    await expect.poll(() => store.archiveCount.hasValue()).toBe(true);
    await expect.poll(() => store.trashCount.hasValue() && store.seats.hasValue()).toBe(true);

    expect(store.seats.value()).toEqual({ plan: 'team', free: 7 });
    expect(store.trashCount.value()).toBe(2);
    expect(store.archiveCount.value()).toBe(3);
  });

  it('shows new space settings at once and restores them when the gateway refuses', async () => {
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    const product: SpaceDetails = space('sp-product', 'Product');
    let refuse: (reason: unknown) => void = () => undefined;
    api.updateSpace.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        refuse = reject;
      }),
    );

    const pending: Promise<SpaceDetails | 'prefix-taken' | null> = store.updateSpace(
      product,
      draftOf(product, 'Product & design'),
    );
    expect(store.spaceById('sp-product')).toMatchObject({
      name: 'Product & design',
      icon: 'rocket',
    });
    refuse(new Error('unavailable'));

    expect(await pending).toBeNull();
    expect(store.spaceById('sp-product')?.name).toBe('Product');
  });

  it('reports a used prefix and emits the recorded space', async () => {
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    const product: SpaceDetails = space('sp-product', 'Product');
    const edits: SpaceDetails[] = [];
    store.spaceEdited.subscribe((edited: SpaceDetails) => edits.push(edited));
    api.updateSpace.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 409,
        error: { type: 'about:blank', status: 409, code: 'space.prefix-taken' },
      }),
    );
    api.updateSpace.mockResolvedValueOnce({ ...product, name: 'Product 2' });

    expect(await store.updateSpace(product, { ...draftOf(product, 'X'), prefix: 'DES' })).toBe(
      'prefix-taken',
    );
    expect(await store.updateSpace(product, draftOf(product, 'Product 2'))).toMatchObject({
      name: 'Product 2',
    });
    expect(edits.map((edited: SpaceDetails) => edited.name)).toEqual(['Product 2']);
  });

  it('removes a deleted space at once and puts it back in place when refused', async () => {
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    api.deleteSpace.mockRejectedValueOnce(new Error('space.manage-forbidden'));
    let settled: boolean | undefined;

    const pending: Promise<boolean> = store
      .deleteSpace(space('sp-product', 'Product'))
      .then((value: boolean) => (settled = value));
    expect(store.spaceById('sp-product')).toBeUndefined();
    await pending;

    expect(settled).toBe(false);
    expect(store.spaces.value()?.map((item: SpaceDetails) => item.id)).toEqual([
      'sp-product',
      'sp-design',
    ]);
  });

  it('creates a space with one key per draft and opens it', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const created: SpaceDetails = space('sp-hr', 'Human resources');
    const draft: SpaceDraft = draftOf(created, 'Human resources');
    api.createSpace.mockRejectedValueOnce(new Error('unavailable'));
    api.createSpace.mockResolvedValueOnce({ space: created, firstList: list('l-hr', 'sp-hr') });

    expect(await store.createSpace(draft)).toBeNull();
    expect(await store.createSpace(draft)).toMatchObject({ firstList: { id: 'l-hr' } });
    expect(api.createSpace.mock.calls[0][1]).toBe(api.createSpace.mock.calls[1][1]);
    expect(store.expanded()['sp-hr']).toBe(true);
    await expect.poll(() => api.spaces.mock.calls.length).toBe(2);
  });

  it('creates a space with a new key in another organization or after the dialog closed', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const created: SpaceDetails = space('sp-hr', 'Human resources');
    const draft: SpaceDraft = draftOf(created, 'Human resources');
    api.createSpace.mockRejectedValue(new Error('unavailable'));

    await store.createSpace(draft);
    store.closeDialog();
    await store.createSpace(draft);
    organization.set({ id: 'org-2', slug: 'lumen' });
    TestBed.tick();
    await store.createSpace(draft);

    const keys: readonly unknown[] = api.createSpace.mock.calls.map((call: unknown[]) => call[1]);
    expect(new Set(keys).size).toBe(3);
  });

  it('creates a list with one key per draft, reused for a retry and renewed after a change', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const draft: ListDraft = {
      name: 'Sprint 15',
      icon: 'lightning',
      color: 'violet',
      sprint: { startDate: '2026-11-17', endDate: '2026-11-30', goal: null },
    };
    lists['create']
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(list('l-sprint15', 'sp-product'))
      .mockResolvedValueOnce(list('l-sprint16', 'sp-product'));

    expect(await store.createList('sp-product', draft)).toBeNull();
    expect(await store.createList('sp-product', draft)).toMatchObject({ id: 'l-sprint15' });
    await store.createList('sp-product', { ...draft, name: 'Sprint 16' });

    const keys: readonly unknown[] = lists['create'].mock.calls.map((call: unknown[]) => call[2]);
    expect(keys[0]).toEqual(expect.any(String));
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('shows a list change in the sidebar at once and restores it when refused', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const backlog: TaskList | undefined = store.overviews.value()?.['sp-product']?.lists[0]?.list;
    if (!backlog) throw new Error('No list');
    let refuse: (reason: unknown) => void = () => undefined;
    lists['update'].mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        refuse = reject;
      }),
    );

    const pending: Promise<TaskList | null> = store.updateList(backlog, {
      name: 'Notebook',
      icon: 'bug',
      color: 'rouge',
      sprint: null,
    });
    expect(store.overviews.value()?.['sp-product']?.lists[0]?.list.name).toBe('Notebook');
    refuse(new Error('list.version-mismatch'));

    expect(await pending).toBeNull();
    expect(store.overviews.value()?.['sp-product']?.lists[0]?.list).toEqual(backlog);
  });

  it('takes an archived list out of the sidebar and puts it back when refused', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const backlog: TaskList | undefined = store.overviews.value()?.['sp-product']?.lists[0]?.list;
    if (!backlog) throw new Error('No list');
    let refuse: (reason: unknown) => void = () => undefined;
    lists['archive'].mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        refuse = reject;
      }),
    );

    const pending: Promise<boolean> = store.archiveList(backlog);
    expect(store.overviews.value()?.['sp-product']?.lists.map((item) => item.list.id)).toEqual([
      'l-sprint14',
    ]);
    expect(store.overviews.value()?.['sp-product']?.taskCount).toBe(20);
    refuse(new Error('unavailable'));

    expect(await pending).toBe(false);
    expect(store.overviews.value()?.['sp-product']?.lists.map((item) => item.list.id)).toEqual([
      'l-backlog',
      'l-sprint14',
    ]);
    expect(store.overviews.value()?.['sp-product']?.taskCount).toBe(30);
  });

  it('opens every space, closes them all and keeps one dialog open', async () => {
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    store.setAllExpanded(true);
    expect(store.expanded()).toEqual({ 'sp-product': true, 'sp-design': true });
    store.setAllExpanded(false);
    expect(store.expanded()).toEqual({});

    store.openDialog({ kind: 'space', space: null });
    store.openDialog({ kind: 'list', spaceId: 'sp-product', list: null, sprint: true });
    expect(store.dialog()).toEqual({
      kind: 'list',
      spaceId: 'sp-product',
      list: null,
      sprint: true,
    });
    store.closeDialog();
    expect(store.dialog()).toBeNull();
  });

  it('closes the spaces and reads again for another organization', async () => {
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    store.setExpanded('sp-product', true);
    expect(store.expanded()).toEqual({ 'sp-product': true });

    organization.set({ id: 'org-2', slug: 'lumen' });
    TestBed.tick();
    expect(store.expanded()).toEqual({});
    await expect.poll(() => api.spaces.mock.calls.length).toBe(2);
  });

  it('adds a favorite at once and restores the list when the gateway refuses', async () => {
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    api.addFavorite.mockRejectedValueOnce(new Error('favorite.limit-reached'));

    const pending: Promise<boolean> = store.setFavorite('list', 'l-bugs', 'Bugs', true);
    expect(store.favoriteOf('list', 'l-bugs')?.name).toBe('Bugs');

    expect(await pending).toBe(false);
    expect(store.favoriteOf('list', 'l-bugs')).toBeUndefined();
    expect(store.favorites.value()).toEqual([roadmap]);
  });

  it('removes a favorite and puts it back when the gateway refuses', async () => {
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    api.removeFavorite.mockRejectedValueOnce(new Error('unavailable'));

    expect(await store.setFavorite('list', 'l-roadmap', 'Roadmap', false)).toBe(false);
    expect(store.favoriteOf('list', 'l-roadmap')).toEqual(roadmap);

    api.removeFavorite.mockResolvedValueOnce(undefined);
    expect(await store.setFavorite('list', 'l-roadmap', 'Roadmap', false)).toBe(true);
    expect(store.favoriteOf('list', 'l-roadmap')).toBeUndefined();
    expect(api.removeFavorite).toHaveBeenLastCalledWith('f1');
  });

  it('replaces the pending favorite with the created one', async () => {
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    api.addFavorite.mockResolvedValueOnce({
      ...roadmap,
      id: 'f2',
      targetId: 'l-bugs',
      name: 'Bugs',
    });

    expect(await store.setFavorite('list', 'l-bugs', 'Bugs', true)).toBe(true);
    expect(store.favoriteOf('list', 'l-bugs')?.id).toBe('f2');
    expect(await store.setFavorite('list', 'l-bugs', 'Bugs', true)).toBe(true);
    expect(api.addFavorite).toHaveBeenCalledTimes(1);
  });

  it('serializes rapid favorite changes using the created identifier', async () => {
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    let resolveCreate!: (favorite: Favorite) => void;
    api.addFavorite.mockReturnValueOnce(
      new Promise<Favorite>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    api.removeFavorite.mockResolvedValueOnce(undefined);

    const added: Promise<boolean> = store.setFavorite('list', 'l-bugs', 'Bugs', true);
    const removed: Promise<boolean> = store.setFavorite('list', 'l-bugs', 'Bugs', false);
    expect(store.favoriteOf('list', 'l-bugs')).toBeUndefined();
    expect(api.removeFavorite).not.toHaveBeenCalled();
    resolveCreate({ ...roadmap, id: 'f2', targetId: 'l-bugs', name: 'Bugs' });
    expect(await added).toBe(true);
    expect(await removed).toBe(true);
    expect(api.removeFavorite).toHaveBeenCalledExactlyOnceWith('f2');
    expect(store.favoriteOf('list', 'l-bugs')).toBeUndefined();
  });

  it('limits concurrent space overview requests to four', async () => {
    const finishes: (() => void)[] = [];
    api.spaces.mockResolvedValueOnce(
      Array.from({ length: 6 }, (_unused: unknown, index: number) =>
        space(String(index), String(index)),
      ),
    );
    api.overview.mockImplementation(
      (spaceId: string): Promise<SpaceOverview> =>
        new Promise((resolve) => {
          finishes.push(() => {
            resolve({ spaceId, taskCount: 0, lists: [] });
          });
        }),
    );
    await expect.poll(() => api.overview.mock.calls.length).toBe(4);
    finishes.splice(0).forEach((finish: () => void) => {
      finish();
    });
    await expect.poll(() => api.overview.mock.calls.length).toBe(6);
    finishes.splice(0).forEach((finish: () => void) => {
      finish();
    });
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
  });

  it('reads the counts of the space of the created task again, and only that space', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const reads: number = api.overview.mock.calls.length;
    api.overview.mockResolvedValueOnce({
      spaceId: 'sp-product',
      taskCount: 31,
      lists: [
        {
          list: list('l-backlog', 'sp-product'),
          counts: { total: 11, open: 9, done: 2, cancelled: 0, late: 0 },
        },
      ],
    });

    creations.next({ key: 'CAD-483', listId: 'l-backlog', status: 'todo', subtasks: 0 });

    await expect.poll(() => store.overviews.value()?.['sp-product']?.taskCount).toBe(31);
    expect(api.overview).toHaveBeenCalledTimes(reads + 1);
    expect(api.overview.mock.calls.at(-1)?.[0]).toBe('sp-product');
    expect(api.spaces).toHaveBeenCalledTimes(1);
  });

  it('reads every overview again when reading the space of the created task fails', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const reads: number = api.overview.mock.calls.length;
    api.overview.mockRejectedValueOnce(new Error('unavailable'));

    creations.next({ key: 'CAD-483', listId: 'l-backlog', status: 'todo', subtasks: 0 });

    await expect.poll(() => api.overview.mock.calls.length).toBe(reads * 2 + 1);
    expect(store.overviews.value()?.['sp-product']?.taskCount).toBe(30);
  });

  it('reads every overview again when the space of the created task is unknown', async () => {
    await expect.poll(() => store.overviews.hasValue()).toBe(true);
    const reads: number = api.overview.mock.calls.length;

    creations.next({ key: 'CAD-483', listId: 'l-elsewhere', status: 'todo', subtasks: 0 });

    await expect.poll(() => api.overview.mock.calls.length).toBe(reads * 2);
  });

  it('reads every overview once more after a read in flight during a creation', async () => {
    const pending: ((value: SpaceOverview) => void)[] = [];
    const answer: ((spaceId: string) => Promise<SpaceOverview>) | undefined =
      api.overview.getMockImplementation();
    if (!answer) throw new Error('No overview fake');
    api.overview.mockImplementation(
      (): Promise<SpaceOverview> =>
        new Promise((resolve: (value: SpaceOverview) => void) => {
          pending.push(resolve);
        }),
    );
    TestBed.tick();
    await expect.poll(() => pending.length).toBe(2);
    const reads: number = api.overview.mock.calls.length;

    creations.next({ key: 'CAD-483', listId: 'l-backlog', status: 'todo', subtasks: 0 });
    api.overview.mockImplementation(answer);
    for (const resolve of pending) resolve(await answer('sp-product'));

    await expect.poll(() => api.overview.mock.calls.length).toBe(reads + 2);
  });

  it('reads the spaces again on refresh', async () => {
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    store.refresh();
    await expect.poll(() => api.spaces.mock.calls.length).toBe(2);
  });

  it('reads the overviews once on refresh, after the new spaces', async () => {
    await expect.poll(() => store.overviews.status()).toBe('resolved');
    const reads: number = api.overview.mock.calls.length;

    store.refresh();
    await expect.poll(() => api.spaces.mock.calls.length).toBe(2);
    await expect.poll(() => store.overviews.status()).toBe('resolved');
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 20);
    });

    expect(api.overview.mock.calls.length).toBe(reads + 2);
  });

  it('reads the counts once more when asked during their first read', async () => {
    let answer: (count: number) => void = (): void => undefined;
    sidebar.trashCount.mockImplementationOnce(
      () =>
        new Promise<number>((resolve: (count: number) => void): void => {
          answer = resolve;
        }),
    );
    TestBed.tick();
    await expect.poll(() => sidebar.trashCount.mock.calls.length).toBe(1);
    expect(store.trashCount.isLoading()).toBe(true);

    store.refreshCounts();
    answer(1);

    await expect.poll(() => sidebar.trashCount.mock.calls.length).toBe(2);
    await expect.poll(() => store.trashCount.value()).toBe(2);
    await expect.poll(() => sidebar.archiveCount.mock.calls.length).toBe(2);
    expect(api.spaces).toHaveBeenCalledTimes(1);
  });

  it('reads the favorites once more when asked during their read', async () => {
    let answer: (favorites: readonly Favorite[]) => void = (): void => undefined;
    api.favorites.mockImplementationOnce(
      () =>
        new Promise<readonly Favorite[]>(
          (resolve: (favorites: readonly Favorite[]) => void): void => {
            answer = resolve;
          },
        ),
    );
    TestBed.tick();
    await expect.poll(() => api.favorites.mock.calls.length).toBe(1);

    store.refreshFavorites();
    answer([]);

    await expect.poll(() => api.favorites.mock.calls.length).toBe(2);
    await expect.poll(() => store.favoriteOf('list', 'l-roadmap')).toEqual(roadmap);
  });
});
