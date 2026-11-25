import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { concatMap, EMPTY, from, type Observable, pipe } from 'rxjs';

import { type CreatedTask, TaskCreate } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { Favorite, FavoriteKind } from '../../models/favorite/favorite.interface';
import type { Space } from '../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../models/task-list/task-list.interface';
import { isWithin, todayIso } from '../../utils/calendar-date/calendar-date.util';

/**
 * Constant OVERVIEW_PAGE_TIMEOUT_MS
 *
 * @description
 * Longest wait for each page of a space overview, in milliseconds: a stalled page must neither hold
 * back the batch of four spaces it is read with, nor the creations read one after the other, while
 * a large space read page after page keeps all the time it needs. A space whose page times out is
 * left out of the overviews, which offers its Retry.
 *
 * @type {number}
 */
const OVERVIEW_PAGE_TIMEOUT_MS: number = 10_000;

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
   * Property _organizationId
   *
   * @description
   * Organization id the reads belong to, or null before the first one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;
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
   * Follows the committed organization; a switch clears the open spaces and reads again.
   *
   * @param {Signal<string> | string} organizationId - Organization id.
   */
  follow(organizationId: Signal<string> | string): void;

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
const initialState: SpacesNavigationState = { expanded: {}, _organizationId: null };

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
          const organizationId: string | null = store._organizationId();
          return organizationId === null ? undefined : { organizationId };
        },
        loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly Space[]> =>
          api.spaces(abortSignal),
      });
      return {
        _api: api,
        _workspace: inject(WORKSPACE_CONTEXT),
        _taskCreate: inject(TaskCreate),
        spaces,
        overviews: resource({
          params: () =>
            spaces.hasValue()
              ? { ids: spaces.value().map((space: Space): string => space.id) }
              : undefined,
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { ids: readonly string[] };
            abortSignal: AbortSignal;
          }): Promise<Readonly<Record<string, SpaceOverview>>> => {
            const today: string = todayIso();
            const byId: Record<string, SpaceOverview> = {};
            for (let offset: number = 0; offset < params.ids.length; offset += 4) {
              abortSignal.throwIfAborted();
              const settled: PromiseSettledResult<SpaceOverview>[] = await Promise.allSettled(
                params.ids
                  .slice(offset, offset + 4)
                  .map((id: string): Promise<SpaceOverview> =>
                    api.overview(id, today, abortSignal, OVERVIEW_PAGE_TIMEOUT_MS),
                  ),
              );
              for (const result of settled) {
                if (result.status === 'fulfilled') byId[result.value.spaceId] = result.value;
              }
            }
            return byId;
          },
        }),
        favorites: resource({
          params: () => {
            const organizationId: string | null = store._organizationId();
            return organizationId === null ? undefined : { organizationId };
          },
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly Favorite[]> =>
            api.favorites(abortSignal),
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
      let refreshQueued: boolean = false;
      let overviewRefreshQueued: boolean = false;
      const pending: Map<
        string,
        { desired: boolean; confirmed: Favorite | undefined; promise: Promise<boolean> }
      > = new Map<
        string,
        { desired: boolean; confirmed: Favorite | undefined; promise: Promise<boolean> }
      >();
      // Reads every overview again, or once more after the read in flight.
      const reloadOverviews: () => void = (): void => {
        if (!store.overviews.reload() && store.overviews.isLoading()) overviewRefreshQueued = true;
      };
      return {
        _flushRefresh: signalMethod<string>((status: string): void => {
          if (status !== 'loading' && status !== 'reloading' && refreshQueued) {
            refreshQueued = false;
            store.spaces.reload();
          }
        }),
        _countCreations: rxMethod<CreatedTask>(
          pipe(
            concatMap((task: CreatedTask): Observable<SpaceOverview> => {
              const organizationId: string | null = store._organizationId();
              const before: Readonly<Record<string, SpaceOverview>> | undefined =
                !store.overviews.isLoading() && store.overviews.hasValue()
                  ? store.overviews.value()
                  : undefined;
              const spaceId: string | undefined =
                before === undefined
                  ? undefined
                  : Object.values(before).find((overview: SpaceOverview): boolean =>
                      overview.lists.some(
                        (summary: ListSummary): boolean => summary.list.id === task.listId,
                      ),
                    )?.spaceId;
              if (before === undefined || spaceId === undefined) {
                reloadOverviews();
                return EMPTY;
              }
              return from(
                store._api.overview(spaceId, todayIso(), undefined, OVERVIEW_PAGE_TIMEOUT_MS),
              ).pipe(
                tapResponse({
                  next: (overview: SpaceOverview): void => {
                    if (store._organizationId() !== organizationId) return;
                    if (
                      store.overviews.isLoading() ||
                      !store.overviews.hasValue() ||
                      store.overviews.value() !== before
                    ) {
                      reloadOverviews();
                    } else {
                      store.overviews.set({ ...before, [spaceId]: overview });
                    }
                  },
                  error: (): void => {
                    if (store._organizationId() === organizationId) reloadOverviews();
                  },
                }),
              );
            }),
          ),
        ),
        _flushOverviews: signalMethod<string>((status: string): void => {
          if (status !== 'loading' && status !== 'reloading' && overviewRefreshQueued) {
            overviewRefreshQueued = false;
            store.overviews.reload();
          }
        }),
        follow: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          patchState(store, {
            _organizationId: organizationId,
            expanded: {},
          });
        }),
        setExpanded(spaceId: string, open: boolean): void {
          patchState(store, { expanded: { ...store.expanded(), [spaceId]: open } });
        },
        refresh(): void {
          if (!store.spaces.reload() && store.spaces.isLoading()) refreshQueued = true;
          reloadOverviews();
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
          const organizationId: string | null = store._organizationId();
          const key: string = `${organizationId ?? ''}:${kind}:${targetId}`;
          const existing: Favorite | undefined = currentFavorites().find(
            (favorite: Favorite): boolean =>
              favorite.kind === kind && favorite.targetId === targetId,
          );
          const active:
            | { desired: boolean; confirmed: Favorite | undefined; promise: Promise<boolean> }
            | undefined = pending.get(key);
          if (!active && on === (existing !== undefined)) return true;
          const pendingId: string = `pending:${kind}:${targetId}`;
          const show: (favorite: Favorite | undefined) => void = (
            favorite: Favorite | undefined,
          ): void => {
            if (organizationId !== store._organizationId()) return;
            const rest: readonly Favorite[] = currentFavorites().filter(
              (item: Favorite): boolean => item.kind !== kind || item.targetId !== targetId,
            );
            store.favorites.set(favorite ? [...rest, favorite] : rest);
          };
          if (active) {
            active.desired = on;
            show(
              on
                ? (active.confirmed ?? { id: pendingId, kind, targetId, name, listId: null })
                : undefined,
            );
            return active.promise;
          }
          const operation: {
            desired: boolean;
            confirmed: Favorite | undefined;
            promise: Promise<boolean>;
          } = { desired: on, confirmed: existing, promise: Promise.resolve(true) };
          pending.set(key, operation);
          show(on ? { id: pendingId, kind, targetId, name, listId: null } : undefined);
          operation.promise = (async (): Promise<boolean> => {
            try {
              while (operation.desired !== (operation.confirmed !== undefined)) {
                if (operation.desired) {
                  operation.confirmed = (await store._api.addFavorite(kind, targetId)) ?? undefined;
                  if (!operation.confirmed) throw new Error('Favorite was not created');
                } else if (operation.confirmed) {
                  await store._api.removeFavorite(operation.confirmed.id);
                  operation.confirmed = undefined;
                }
                show(operation.desired ? operation.confirmed : undefined);
              }
              return true;
            } catch {
              show(operation.confirmed);
              return false;
            } finally {
              pending.delete(key);
            }
          })();
          return operation.promise;
        },
      };
    }),
    withHooks({
      onInit(store): void {
        const organizationId: Signal<string> = computed(
          (): string => store._workspace.organization().id,
        );
        store.follow(organizationId);
        store._flushRefresh(store.spaces.status);
        store._flushOverviews(store.overviews.status);
        store._countCreations(store._taskCreate.created);
      },
    }),
  );
}

/**
 * Constant SpacesNavigationStore
 *
 * @description
 * The spaces navigation of a workspace, provided on `/:org` by `provideSpacesNavigation()` so the
 * sidebar, the sprint progress and the list screens share one read. Keyed on the organization
 * id committed by the workspace. A switch closes every space and reads again. At most four
 * overviews run at once; a failed read offers an inline retry. A task created from this tab reads
 * the overview of its list's space again, and only that one, one creation after the other, each
 * page given 10 s. When that space is unknown, the overviews are loading, they changed while the
 * space was read, or the read failed, every overview is read again instead (after the read in
 * flight): an answer never overwrites a newer one, no creation is missed, and a space that still
 * fails shows its Retry.
 * Favorites change optimistically; a refusal restores the previous list.
 *
 * @type {ReturnType<typeof createSpacesNavigationStore>}
 */
export const SpacesNavigationStore: ReturnType<typeof createSpacesNavigationStore> =
  createSpacesNavigationStore();
