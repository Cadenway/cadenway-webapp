import { inject, Service } from '@angular/core';
import {
  type Favorite as FavoriteDto,
  type FavoritePage,
  type ListSummary as ListSummaryDto,
  type MilestonePage as MilestonePageDto,
  type Space as SpaceDto,
  type SpaceOverview as SpaceOverviewDto,
  type SpacePage,
  SpacesService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type { Favorite, FavoriteKind } from '../../../models/favorite/favorite.interface';
import type { MilestonePage } from '../../../models/milestone/milestone.interface';
import type { Space } from '../../../models/space/space.interface';
import type { SpaceOverview } from '../../../models/task-list/task-list.interface';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import {
  toFavorite,
  toMilestonePage,
  toSpace,
  toSpaceOverview,
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
   * @returns {Promise<readonly Space[]>} The spaces.
   */
  public async spaces(): Promise<readonly Space[]> {
    const items: SpaceDto[] = [];
    let cursor: string | undefined;
    do {
      const page: SpacePage = await firstValueFrom(
        this.spacesService.listSpaces({ limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
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
   * @returns {Promise<Space>} The space.
   * @throws {Error} The typed route error of the failure.
   */
  public async space(spaceId: string): Promise<Space> {
    try {
      return toSpace(await firstValueFrom(this.spacesService.getSpace(spaceId)));
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
   * @returns {Promise<SpaceOverview>} The overview.
   * @throws {Error} The typed route error of the failure.
   */
  public async overview(spaceId: string, today: string): Promise<SpaceOverview> {
    const items: ListSummaryDto[] = [];
    let cursor: string | undefined;
    let taskCount: number;
    try {
      do {
        const page: SpaceOverviewDto = await firstValueFrom(
          this.spacesService.getSpaceOverview(spaceId, {
            today,
            limit: PAGE_LIMIT,
            ...(cursor ? { cursor } : {}),
          }),
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
   * @returns {Promise<MilestonePage>} The milestones and their total.
   */
  public async milestones(spaceId: string): Promise<MilestonePage> {
    const page: MilestonePageDto = await firstValueFrom(
      this.spacesService.listSpaceMilestones(spaceId, { limit: MILESTONE_LIMIT }),
    );
    return toMilestonePage(page);
  }

  /**
   * Method favorites
   *
   * @description
   * Reads every favorite of the caller, in insertion order; unknown kinds are left out.
   *
   * @returns {Promise<readonly Favorite[]>} The favorites.
   */
  public async favorites(): Promise<readonly Favorite[]> {
    const items: FavoriteDto[] = [];
    let cursor: string | undefined;
    do {
      const page: FavoritePage = await firstValueFrom(
        this.spacesService.listFavorites({ limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
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
  // #endregion
}
