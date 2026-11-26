import { HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type IntakeFormConfiguration as IntakeFormConfigurationDto,
  IntakeManagementService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type {
  IntakeFormChange,
  IntakeFormConfiguration,
} from '../../../models/intake-form/intake-form.interface';
import {
  toIntakeFormConfiguration,
  toIntakeFormPatch,
} from '../../adapters/intake-form/intake-form.adapter';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Function isUncertainWrite
 *
 * @description
 * Whether a failed write may still have been recorded: no answer, a timeout or a server failure
 * (`5xx`), unlike a refusal (`4xx`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether its outcome is unknown.
 */
export function isUncertainWrite(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
}

/**
 * Service IntakeFormApi
 *
 * @description
 * The `Form` view's access to `intake-management` of the gateway: a list's request form, its
 * changes, its publication and its withdrawal. Every operation requires `edit` on the list.
 */
@Service()
export class IntakeFormApi {
  // #region Properties
  /**
   * Property intake
   *
   * @description
   * Generated intake management operations.
   *
   * @type {IntakeManagementService}
   * @readonly
   */
  private readonly intake: IntakeManagementService = inject(IntakeManagementService);
  // #endregion

  // #region Methods
  /**
   * Method configuration
   *
   * @description
   * Reads the list's form settings: the view's primary read, whose failure rejects with the typed
   * route error of the list.
   *
   * @param {string} listId - The list.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<IntakeFormConfiguration>} The settings, publication and version.
   */
  public async configuration(
    listId: string,
    signal?: AbortSignal,
  ): Promise<IntakeFormConfiguration> {
    try {
      const dto: IntakeFormConfigurationDto = await abortableRead(
        this.intake.getIntakeFormConfiguration(listId),
        signal,
      );
      return toIntakeFormConfiguration(dto);
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }

  /**
   * Method update
   *
   * @description
   * Changes some settings against the version they were changed from (`If-Match`); a stale
   * version is refused with `412`, invalid defaults with `422 intake-form.defaults-invalid`.
   *
   * @param {string} listId - The list.
   * @param {IntakeFormChange} change - The changed settings.
   * @param {number} version - Version they were changed from.
   * @returns {Promise<IntakeFormConfiguration>} The saved settings.
   */
  public async update(
    listId: string,
    change: IntakeFormChange,
    version: number,
  ): Promise<IntakeFormConfiguration> {
    const dto: IntakeFormConfigurationDto = await firstValueFrom(
      this.intake.updateIntakeFormConfiguration(listId, toIntakeFormPatch(change), {
        headers: { 'If-Match': `"${String(version)}"` },
      }),
    );
    return toIntakeFormConfiguration(dto);
  }

  /**
   * Method publish
   *
   * @description
   * Publishes the form with its current settings, without a precondition (publishing twice
   * keeps the key): a disabled form gets a new key.
   *
   * @param {string} listId - The list.
   * @returns {Promise<IntakeFormConfiguration>} The settings with their public key.
   */
  public async publish(listId: string): Promise<IntakeFormConfiguration> {
    const dto: IntakeFormConfigurationDto = await firstValueFrom(
      this.intake.publishIntakeForm(listId),
    );
    return toIntakeFormConfiguration(dto);
  }

  /**
   * Method disable
   *
   * @description
   * Withdraws the publication at once, keeping the settings, then reads them again for their new
   * version (the withdrawal answers without a body).
   *
   * @param {string} listId - The list.
   * @returns {Promise<IntakeFormConfiguration>} The settings, without a public key.
   */
  public async disable(listId: string): Promise<IntakeFormConfiguration> {
    await firstValueFrom(this.intake.disableIntakeForm(listId));
    const dto: IntakeFormConfigurationDto = await firstValueFrom(
      this.intake.getIntakeFormConfiguration(listId),
    );
    return toIntakeFormConfiguration(dto);
  }
  // #endregion
}
