import { inject, Service } from '@angular/core';
import { type Space as SpaceDto, SpacesService } from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type { SpaceDetails } from '../../../models/space/space.interface';
import type { SpaceStatusesChange } from '../../../models/space-status-change/space-status-change.interface';
import { toSpace } from '../../adapters/space/space.adapter';

/**
 * Service SpaceStatusesApi
 *
 * @description
 * The `Space statuses` dialog's access to `updateSpace`: it sends only the `statuses` member of
 * the merge patch, from the version shown (`If-Match`, `412 request.version-mismatch` when the
 * space changed meanwhile), and maps the space as recorded.
 */
@Service()
export class SpaceStatusesApi {
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
   * Method update
   *
   * @description
   * Renames or hides statuses of a space, or puts back every default when `change` is null.
   *
   * @param {string} spaceId - The space.
   * @param {number} version - The version shown, sent as `If-Match`.
   * @param {SpaceStatusesChange} change - The statuses changed, by key, or null.
   * @returns {Promise<SpaceDetails>} The space as recorded.
   */
  public async update(
    spaceId: string,
    version: number,
    change: SpaceStatusesChange,
  ): Promise<SpaceDetails> {
    const recorded: SpaceDto = await firstValueFrom(
      this.spacesService.updateSpace(
        spaceId,
        { statuses: change },
        { headers: { 'If-Match': `"${String(version)}"` } },
      ),
    );
    return toSpace(recorded);
  }
  // #endregion
}
