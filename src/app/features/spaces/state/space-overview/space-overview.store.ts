import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { MilestonePage } from '../../models/milestone/milestone.interface';
import type { Space } from '../../models/space/space.interface';
import type { SpaceOverview } from '../../models/task-list/task-list.interface';
import { SpacesNavigationStore } from '../spaces-navigation/spaces-navigation.store';
import { todayIso } from '../../utils/calendar-date/calendar-date.util';

/**
 * Interface SpaceOverviewState
 *
 * @description
 * The space the overview shows.
 */
interface SpaceOverviewState {
  // #region Properties
  /**
   * Property spaceId
   *
   * @description
   * The space of the route, or null before the page binds it.
   *
   * @type {string | null}
   * @readonly
   */
  readonly spaceId: string | null;
  // #endregion
}

/**
 * Interface SpaceOverviewStoreInstance
 *
 * @description
 * A space, its lists with their counts and its milestones.
 */
export interface SpaceOverviewStoreInstance {
  // #region Properties
  /**
   * Property spaceId
   *
   * @description
   * The space of the route.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly spaceId: Signal<string | null>;

  /**
   * Property space
   *
   * @description
   * Primary read: a failure rejects with the typed route error.
   *
   * @type {ResourceRef<Space | undefined>}
   * @readonly
   */
  readonly space: ResourceRef<Space | undefined>;

  /**
   * Property overview
   *
   * @description
   * Primary read of the list cards: a failure rejects with the typed route error.
   *
   * @type {ResourceRef<SpaceOverview | undefined>}
   * @readonly
   */
  readonly overview: ResourceRef<SpaceOverview | undefined>;

  /**
   * Property milestones
   *
   * @description
   * Secondary read of the « Jalons » section.
   *
   * @type {ResourceRef<MilestonePage | undefined>}
   * @readonly
   */
  readonly milestones: ResourceRef<MilestonePage | undefined>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the space of the route.
   *
   * @param {Signal<string> | string} spaceId - The space.
   */
  load(spaceId: Signal<string> | string): void;
  // #endregion
}

/**
 * Function createSpaceOverviewStore
 *
 * @description
 * Creates the space overview store.
 *
 * @returns {Type<SpaceOverviewStoreInstance>} Injectable store constructor.
 */
function createSpaceOverviewStore(): Type<SpaceOverviewStoreInstance> {
  return signalStore(
    withState<SpaceOverviewState>({ spaceId: null }),
    withProps((store) => {
      const api: SpacesApi = inject(SpacesApi);
      const navigation: InstanceType<typeof SpacesNavigationStore> = inject(SpacesNavigationStore);
      const bySpace: () => { spaceId: string } | undefined = () => {
        const spaceId: string | null = store.spaceId();
        return spaceId === null ? undefined : { spaceId };
      };
      return {
        space: resource({
          params: bySpace,
          loader: ({
            params,
            abortSignal,
          }: {
            params: { spaceId: string };
            abortSignal: AbortSignal;
          }): Promise<Space> => api.space(params.spaceId, abortSignal),
        }),
        overview: resource({
          params: bySpace,
          loader: ({
            params,
            abortSignal,
          }: {
            params: { spaceId: string };
            abortSignal: AbortSignal;
          }): Promise<SpaceOverview> =>
            navigation.overviews.status() === 'resolved' &&
            navigation.overviews.hasValue() &&
            params.spaceId in navigation.overviews.value()
              ? Promise.resolve(navigation.overviews.value()[params.spaceId])
              : api.overview(params.spaceId, todayIso(), abortSignal),
        }),
        milestones: resource({
          params: bySpace,
          loader: ({
            params,
            abortSignal,
          }: {
            params: { spaceId: string };
            abortSignal: AbortSignal;
          }): Promise<MilestonePage> => api.milestones(params.spaceId, abortSignal),
        }),
      };
    }),
    withMethods((store) => ({
      load: signalMethod<string>((spaceId: string): void => {
        if (spaceId !== store.spaceId()) patchState(store, { spaceId });
      }),
    })),
  );
}

/**
 * Constant SpaceOverviewStore
 *
 * @description
 * The overview of a space (« Vue d’ensemble »), provided by its page. The space and its lists are
 * the primary reads; the milestones keep an inline error with « Réessayer ».
 *
 * @type {ReturnType<typeof createSpaceOverviewStore>}
 */
export const SpaceOverviewStore: ReturnType<typeof createSpaceOverviewStore> =
  createSpaceOverviewStore();
