import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { Favorite, FavoriteKind } from '../../models/favorite/favorite.interface';
import type { Space } from '../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../models/task-list/task-list.interface';
import { isWithin, todayIso } from '../../utils/calendar-date/calendar-date.util';

/**
 * Interface SpacesNavigationState
 *
 * @description
 * The organization the navigation belongs to, the open spaces and the read revisions.
 */
interface SpacesNavigationState {
  // #region Properties
  /**
   * Property expanded
   *
   * @description
   * Spaces whose lists show, by id.
   *
   * @type {Readonly<Record<string, boolean>>}
   * @readonly
   */
  readonly expanded: Readonly<Record<string, boolean>>;

  /**
   * Property _slug
   *
   * @description
   * Organization slug the reads belong to, or null before the first one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _slug: string | null;

  /**
   * Property _revision
   *
   * @description
   * Bumped to read the spaces and their counts again.
   *
   * @type {number}
   * @readonly
   */
  readonly _revision: number;
  // #endregion
}

/**
 * Interface SpacesNavigationStoreInstance
 *
 * @description
 * The spaces of the sidebar, their lists and counts, the current sprint and the favorites.
 */
interface SpacesNavigationStoreInstance {
  // #region Properties
  /**
   * Property expanded
   *
   * @description
   * Spaces whose lists show, by id.
   *
   * @type {Signal<Readonly<Record<string, boolean>>>}
   * @readonly
   */
  readonly expanded: Signal<Readonly<Record<string, boolean>>>;

  /**
   * Property spaces
   *
   * @description
   * The spaces the caller sees; idle until an organization is followed.
   *
   * @type {ResourceRef<readonly Space[] | undefined>}
   * @readonly
   */
  readonly spaces: ResourceRef<readonly Space[] | undefined>;

  /**
   * Property overviews
   *
   * @description
   * The lists and counts of each space by id; a space whose read failed is absent.
   *
   * @type {ResourceRef<Readonly<Record<string, SpaceOverview>> | undefined>}
   * @readonly
   */
  readonly overviews: ResourceRef<Readonly<Record<string, SpaceOverview>> | undefined>;

  /**
   * Property favorites
   *
   * @description
   * The caller's favorites, in insertion order.
   *
   * @type {ResourceRef<readonly Favorite[] | undefined>}
   * @readonly
   */
  readonly favorites: ResourceRef<readonly Favorite[] | undefined>;

  /**
   * Property currentSprint
   *
   * @description
   * The first sprint, in sidebar order, whose dates hold the caller's today, or null.
   *
   * @type {Signal<ListSummary | null>}
   * @readonly
   */
  readonly currentSprint: Signal<ListSummary | null>;
  // #endregion

  // #region Methods
  /**
   * Method follow
   *
   * @description
   * Follows the organization of the route; a new slug clears the open spaces and reads again.
   *
   * @param {Signal<string> | string} slug - Organization slug.
   */
  follow(slug: Signal<string> | string): void;

  /**
   * Method setExpanded
   *
   * @description
   * Opens or closes a space's lists.
   *
   * @param {string} spaceId - The space.
   * @param {boolean} open - Whether its lists show.
   */
  setExpanded(spaceId: string, open: boolean): void;

  /**
   * Method refresh
   *
   * @description
   * Reads the spaces and their counts again, after a write that changed them.
   */
  refresh(): void;

  /**
   * Method favoriteOf
   *
   * @description
   * The favorite pointing to a target, if any.
   *
   * @param {FavoriteKind} kind - Target kind.
   * @param {string} targetId - Target identifier.
   * @returns {Favorite | undefined} The favorite.
   */
  favoriteOf(kind: FavoriteKind, targetId: string): Favorite | undefined;

  /**
   * Method setFavorite
   *
   * @description
   * Adds or removes a favorite at once, then records it; a refusal restores the previous list.
   *
   * @param {FavoriteKind} kind - Target kind.
   * @param {string} targetId - Target identifier.
   * @param {string} name - Target name, shown until the gateway answers.
   * @param {boolean} on - Whether the target becomes a favorite.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  setFavorite(kind: FavoriteKind, targetId: string, name: string, on: boolean): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No organization followed, every space closed.
 *
 * @type {SpacesNavigationState}
 */
const initialState: SpacesNavigationState = { expanded: {}, _slug: null, _revision: 0 };

/**
 * Function createSpacesNavigationStore
 *
 * @description
 * Creates the navigation store.
 *
 * @returns {Type<SpacesNavigationStoreInstance>} Injectable store constructor.
 */
function createSpacesNavigationStore(): Type<SpacesNavigationStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: SpacesApi = inject(SpacesApi);
      const spaces: ResourceRef<readonly Space[] | undefined> = resource({
        params: () => {
          const slug: string | null = store._slug();
          return slug === null ? undefined : { slug, revision: store._revision() };
        },
        loader: (): Promise<readonly Space[]> => api.spaces(),
      });
      return {
        _api: api,
        spaces,
        overviews: resource({
          params: () =>
            spaces.hasValue()
              ? { ids: spaces.value().map((space: Space): string => space.id) }
              : undefined,
          loader: async ({
            params,
          }: {
            params: { ids: readonly string[] };
          }): Promise<Readonly<Record<string, SpaceOverview>>> => {
            const today: string = todayIso();
            const settled: PromiseSettledResult<SpaceOverview>[] = await Promise.allSettled(
              params.ids.map((id: string): Promise<SpaceOverview> => api.overview(id, today)),
            );
            const byId: Record<string, SpaceOverview> = {};
            for (const result of settled) {
              if (result.status === 'fulfilled') byId[result.value.spaceId] = result.value;
            }
            return byId;
          },
        }),
        favorites: resource({
          params: () => {
            const slug: string | null = store._slug();
            return slug === null ? undefined : { slug };
          },
          loader: (): Promise<readonly Favorite[]> => api.favorites(),
        }),
      };
    }),
    withComputed((store) => ({
      currentSprint: (): ListSummary | null => {
        if (!store.spaces.hasValue() || !store.overviews.hasValue()) return null;
        const today: string = todayIso();
        const overviews: Readonly<Record<string, SpaceOverview>> = store.overviews.value();
        for (const space of store.spaces.value()) {
          const overview: SpaceOverview | undefined =
            space.id in overviews ? overviews[space.id] : undefined;
          const found: ListSummary | undefined = overview?.lists.find(
            (summary: ListSummary): boolean =>
              summary.list.sprint !== null &&
              isWithin(today, summary.list.sprint.startDate, summary.list.sprint.endDate),
          );
          if (found) return found;
        }
        return null;
      },
    })),
    withMethods((store) => {
      const currentFavorites: () => readonly Favorite[] = () =>
        store.favorites.hasValue() ? store.favorites.value() : [];
      return {
        follow: signalMethod<string>((slug: string): void => {
          if (slug === store._slug()) return;
          patchState(store, { _slug: slug, expanded: {}, _revision: store._revision() + 1 });
        }),
        setExpanded(spaceId: string, open: boolean): void {
          patchState(store, { expanded: { ...store.expanded(), [spaceId]: open } });
        },
        refresh(): void {
          patchState(store, { _revision: store._revision() + 1 });
        },
        favoriteOf(kind: FavoriteKind, targetId: string): Favorite | undefined {
          return currentFavorites().find(
            (favorite: Favorite): boolean =>
              favorite.kind === kind && favorite.targetId === targetId,
          );
        },
        async setFavorite(
          kind: FavoriteKind,
          targetId: string,
          name: string,
          on: boolean,
        ): Promise<boolean> {
          const slug: string | null = store._slug();
          const existing: Favorite | undefined = currentFavorites().find(
            (favorite: Favorite): boolean =>
              favorite.kind === kind && favorite.targetId === targetId,
          );
          if (on === (existing !== undefined)) return true;
          const pendingId: string = `pending:${kind}:${targetId}`;
          const without: (favorites: readonly Favorite[], id: string) => readonly Favorite[] = (
            favorites,
            id,
          ) => favorites.filter((favorite: Favorite): boolean => favorite.id !== id);
          if (on) {
            store.favorites.set([
              ...currentFavorites(),
              { id: pendingId, kind, targetId, name, listId: null },
            ]);
          } else if (existing) {
            store.favorites.set(without(currentFavorites(), existing.id));
          }
          try {
            if (on) {
              const created: Favorite | null = await store._api.addFavorite(kind, targetId);
              if (slug === store._slug()) {
                const rest: readonly Favorite[] = without(currentFavorites(), pendingId);
                store.favorites.set(created ? [...rest, created] : rest);
              }
            } else if (existing) {
              await store._api.removeFavorite(existing.id);
            }
            return true;
          } catch {
            if (slug === store._slug()) {
              if (on) store.favorites.set(without(currentFavorites(), pendingId));
              else if (existing) store.favorites.set([...currentFavorites(), existing]);
            }
            return false;
          }
        },
      };
    }),
  );
}

/**
 * Constant SpacesNavigationStore
 *
 * @description
 * The spaces navigation of a workspace, provided on `/:org` by `provideSpacesNavigation()` so the
 * sidebar, the sprint progress and the list screens share one read. Keyed on the organization
 * slug the sidebar follows: a new slug closes every space and reads again. The counts of every
 * space are read in parallel, one overview per space, and a space whose read fails shows no
 * count. Favorites change optimistically; a refusal restores the previous list.
 *
 * @type {ReturnType<typeof createSpacesNavigationStore>}
 */
export const SpacesNavigationStore: ReturnType<typeof createSpacesNavigationStore> =
  createSpacesNavigationStore();
