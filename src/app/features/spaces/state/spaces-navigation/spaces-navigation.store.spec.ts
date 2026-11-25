import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { Favorite } from '../../models/favorite/favorite.interface';
import type { Space } from '../../models/space/space.interface';
import type { SpaceOverview, TaskList } from '../../models/task-list/task-list.interface';
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
 * @returns {Space} The space.
 */
function space(id: string, name: string): Space {
  return { id, name, description: null, icon: null, color: 'gris', private: false, statuses: [] };
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
  // #endregion
}

describe('SpacesNavigationStore', () => {
  let api: SpacesApiFake;
  let store: InstanceType<typeof SpacesNavigationStore>;
  const today: string = todayIso();
  const roadmap: Favorite = {
    id: 'f1',
    kind: 'list',
    targetId: 'l-roadmap',
    name: 'Feuille de route',
    listId: null,
  };

  beforeEach(() => {
    api = {
      spaces: vi.fn(() =>
        Promise.resolve([space('sp-produit', 'Produit'), space('sp-design', 'Design')]),
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
    };
    TestBed.configureTestingModule({
      providers: [SpacesNavigationStore, { provide: SpacesApi, useValue: api }],
    });
    store = TestBed.inject(SpacesNavigationStore);
  });

  it('reads nothing before following an organization, then the spaces, counts and favorites', async () => {
    TestBed.tick();
    expect(api.spaces).not.toHaveBeenCalled();

    store.follow('atelier-nord');
    await expect.poll(() => store.overviews.hasValue()).toBe(true);

    expect(store.spaces.value()?.map((item: Space) => item.name)).toEqual(['Produit', 'Design']);
    expect(Object.keys(store.overviews.value() ?? {})).toEqual(['sp-produit']);
    expect(store.currentSprint()?.list.id).toBe('l-sprint14');
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    expect(store.favoriteOf('list', 'l-roadmap')).toEqual(roadmap);
  });

  it('closes the spaces and reads again for another organization', async () => {
    store.follow('atelier-nord');
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    store.setExpanded('sp-produit', true);
    expect(store.expanded()).toEqual({ 'sp-produit': true });

    store.follow('lumen');
    expect(store.expanded()).toEqual({});
    await expect.poll(() => api.spaces.mock.calls.length).toBe(2);
  });

  it('adds a favorite at once and restores the list when the gateway refuses', async () => {
    store.follow('atelier-nord');
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    api.addFavorite.mockRejectedValueOnce(new Error('favorite.limit-reached'));

    const pending: Promise<boolean> = store.setFavorite('list', 'l-bugs', 'Bugs', true);
    expect(store.favoriteOf('list', 'l-bugs')?.name).toBe('Bugs');

    expect(await pending).toBe(false);
    expect(store.favoriteOf('list', 'l-bugs')).toBeUndefined();
    expect(store.favorites.value()).toEqual([roadmap]);
  });

  it('removes a favorite and puts it back when the gateway refuses', async () => {
    store.follow('atelier-nord');
    await expect.poll(() => store.favorites.hasValue()).toBe(true);
    api.removeFavorite.mockRejectedValueOnce(new Error('unavailable'));

    expect(await store.setFavorite('list', 'l-roadmap', 'Feuille de route', false)).toBe(false);
    expect(store.favoriteOf('list', 'l-roadmap')).toEqual(roadmap);

    api.removeFavorite.mockResolvedValueOnce(undefined);
    expect(await store.setFavorite('list', 'l-roadmap', 'Feuille de route', false)).toBe(true);
    expect(store.favoriteOf('list', 'l-roadmap')).toBeUndefined();
    expect(api.removeFavorite).toHaveBeenLastCalledWith('f1');
  });

  it('replaces the pending favorite with the created one', async () => {
    store.follow('atelier-nord');
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

  it('reads the spaces again on refresh', async () => {
    store.follow('atelier-nord');
    await expect.poll(() => store.spaces.hasValue()).toBe(true);
    store.refresh();
    await expect.poll(() => api.spaces.mock.calls.length).toBe(2);
  });
});
