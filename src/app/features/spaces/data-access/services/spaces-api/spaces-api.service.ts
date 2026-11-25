import { inject, Service } from '@angular/core';
import {
  type Favorite as FavoriteDto,
  type FavoritePage,
  type ListSummary as ListSummaryDto,
  type MilestonePage as MilestonePageDto,
  type Space as SpaceDto,
  type SpaceOverview as SpaceOverviewDto,
  type SpaceCreated,
  type SpacePage,
  SpacesService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type { Favorite, FavoriteKind } from '../../../models/favorite/favorite.interface';
import type { MilestonePage } from '../../../models/milestone/milestone.interface';
import type { SpaceDetails, SpaceDraft } from '../../../models/space/space.interface';
import type { SpaceOverview, TaskList } from '../../../models/task-list/task-list.interface';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import {
  toFavorite,
  toMilestonePage,
  toSpace,
  toSpaceOverview,
  toTaskList,
} from '../../adapters/space/space.adapter';

/**
 * Constant PAGE_LIMIT
 *
 * @description
 * Page size asked of the gateway when a read joins every page.
 *
 * @type {number}
 */
const PAGE_LIMIT: number = 100;

/**
 * Constant MILESTONE_LIMIT
 *
 * @description
 * Milestones the overview lists; the section's count gives the total.
 *
 * @type {number}
 */
const MILESTONE_LIMIT: number = 50;

/**
 * Service SpacesApi
 *
 * @description
 * The spaces feature's access to `spaces` of the gateway: the spaces, their overview and
 * milestones, and the caller's favorites, mapped to display models. Reads that join pages follow
 * every cursor.
 */
@Service()
export class SpacesApi {
  // #region Properties
  /**
   * Property spacesService
   *
   * @description
   * Generated space operations.
   *
   * @type {SpacesService}
   * @readonly
   */
  private readonly spacesService: SpacesService = inject(SpacesService);
  // #endregion

  // #region Methods
  /**
   * Method spaces
   *
   * @description
   * Reads every space the caller sees, in sidebar order.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly SpaceDetails[]>} The spaces.
   */
  public async spaces(signal?: AbortSignal): Promise<readonly SpaceDetails[]> {
    const items: SpaceDto[] = [];
    let cursor: string | undefined;
    do {
      const page: SpacePage = await abortableRead(
        this.spacesService.listSpaces({ limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
        signal,
      );
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items.map(toSpace);
  }

  /**
   * Method space
   *
   * @description
   * Reads one space, the primary read of its overview.
   *
   * @param {string} spaceId - The space.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<SpaceDetails>} The space.
   * @throws {Error} The typed route error of the failure.
   */
  public async space(spaceId: string, signal?: AbortSignal): Promise<SpaceDetails> {
    try {
      return toSpace(await abortableRead(this.spacesService.getSpace(spaceId), signal));
    } catch (error: unknown) {
      throw toRouteError(error, 'space', spaceId);
    }
  }

  /**
   * Method overview
   *
   * @description
   * Reads the lists of a space with their counts, every page.
   *
   * @param {string} spaceId - The space.
   * @param {string} today - The caller's date, `YYYY-MM-DD`, for the late tasks.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @param {number | undefined} pageTimeoutMs - Longest wait for each page, in milliseconds; a
   * page that takes longer fails the read, however many pages came before.
   * @returns {Promise<SpaceOverview>} The overview.
   * @throws {Error} The typed route error of the failure.
   */
  public async overview(
    spaceId: string,
    today: string,
    signal?: AbortSignal,
    pageTimeoutMs?: number,
  ): Promise<SpaceOverview> {
    const items: ListSummaryDto[] = [];
    let cursor: string | undefined;
    let taskCount: number;
    try {
      do {
        const page: SpaceOverviewDto = await abortableRead(
          this.spacesService.getSpaceOverview(spaceId, {
            today,
            limit: PAGE_LIMIT,
            ...(cursor ? { cursor } : {}),
          }),
          pageTimeoutMs === undefined
            ? signal
            : AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(pageTimeoutMs)]),
        );
        items.push(...page.items);
        taskCount = page.taskCount;
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    } catch (error: unknown) {
      throw toRouteError(error, 'space', spaceId);
    }
    return toSpaceOverview(spaceId, taskCount, items);
  }

  /**
   * Method milestones
   *
   * @description
   * Reads the first milestones of a space, by due date.
   *
   * @param {string} spaceId - The space.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<MilestonePage>} The milestones and their total.
   */
  public async milestones(spaceId: string, signal?: AbortSignal): Promise<MilestonePage> {
    const page: MilestonePageDto = await abortableRead(
      this.spacesService.listSpaceMilestones(spaceId, { limit: MILESTONE_LIMIT }),
      signal,
    );
    return toMilestonePage(page);
  }

  /**
   * Method favorites
   *
   * @description
   * Reads every favorite of the caller, in insertion order; unknown kinds are left out.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly Favorite[]>} The favorites.
   */
  public async favorites(signal?: AbortSignal): Promise<readonly Favorite[]> {
    const items: FavoriteDto[] = [];
    let cursor: string | undefined;
    do {
      const page: FavoritePage = await abortableRead(
        this.spacesService.listFavorites({ limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
        signal,
      );
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items
      .map(toFavorite)
      .filter((favorite: Favorite | null): favorite is Favorite => favorite !== null);
  }

  /**
   * Method addFavorite
   *
   * @description
   * Adds a favorite.
   *
   * @param {FavoriteKind} kind - Target kind.
   * @param {string} targetId - Target identifier.
   * @returns {Promise<Favorite | null>} The favorite, or null when the gateway answered a kind this version does not know.
   */
  public async addFavorite(kind: FavoriteKind, targetId: string): Promise<Favorite | null> {
    return toFavorite(await firstValueFrom(this.spacesService.createFavorite({ kind, targetId })));
  }

  /**
   * Method removeFavorite
   *
   * @description
   * Removes a favorite.
   *
   * @param {string} favoriteId - The favorite.
   * @returns {Promise<void>} Resolves once removed.
   */
  public async removeFavorite(favoriteId: string): Promise<void> {
    await firstValueFrom(this.spacesService.deleteFavorite(favoriteId));
  }

  /**
   * Method createSpace
   *
   * @description
   * Creates a space owned by the caller with its « Première liste », in one transaction. A retry
   * of the same draft reuses its idempotency key, so a lost answer creates nothing twice.
   *
   * @param {SpaceDraft} draft - The dialog's values.
   * @param {string} idempotencyKey - Key of this creation.
   * @returns {Promise<{ space: SpaceDetails; firstList: TaskList }>} The space and its first list.
   */
  public async createSpace(
    draft: SpaceDraft,
    idempotencyKey: string,
  ): Promise<{ space: SpaceDetails; firstList: TaskList }> {
    const created: SpaceCreated = await firstValueFrom(
      this.spacesService.createSpace(
        {
          name: draft.name,
          prefix: draft.prefix,
          description: draft.description,
          icon: draft.icon,
          color: draft.color,
          visibility: draft.private ? 'private' : 'organization',
        },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    return { space: toSpace(created.space), firstList: toTaskList(created.firstList) };
  }

  /**
   * Method updateSpace
   *
   * @description
   * Changes a space's settings. The visibility is sent only when it changes, since only the
   * people who manage the space may send it.
   *
   * @param {SpaceDetails} space - The space as shown.
   * @param {SpaceDraft} draft - The dialog's values.
   * @returns {Promise<SpaceDetails>} The space as recorded.
   */
  public async updateSpace(space: SpaceDetails, draft: SpaceDraft): Promise<SpaceDetails> {
    return toSpace(
      await firstValueFrom(
        this.spacesService.updateSpace(space.id, {
          name: draft.name,
          prefix: draft.prefix,
          description: draft.description,
          icon: draft.icon,
          color: draft.color,
          ...(draft.private === space.private
            ? {}
            : { visibility: draft.private ? 'private' : 'organization' }),
        }),
      ),
    );
  }

  /**
   * Method deleteSpace
   *
   * @description
   * Deletes a space with its lists; its tasks reach the trash within minutes.
   *
   * @param {string} spaceId - The space.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteSpace(spaceId: string): Promise<void> {
    await firstValueFrom(this.spacesService.deleteSpace(spaceId));
  }
  // #endregion
}
