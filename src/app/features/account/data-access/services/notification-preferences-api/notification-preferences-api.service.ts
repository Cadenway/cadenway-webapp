import { inject, Service } from '@angular/core';
import {
  type NotificationChannelSettings,
  type NotificationPreferences as NotificationPreferencesDto,
  type NotificationPreferencesPatch,
  NotificationPreferencesService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { type ApiProblem, hasProblemCode, readProblem } from '@core/api';

import type {
  NotificationChannels,
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../../models/notification-preferences/notification-preferences.interface';

/**
 * Function toChannels
 *
 * @description
 * The channels of one event as the page shows them.
 *
 * @param {NotificationChannelSettings} dto - The event's channels as the gateway answers them.
 * @returns {NotificationChannels} The channels.
 */
function toChannels(dto: NotificationChannelSettings): NotificationChannels {
  return { inApp: dto.inApp, email: dto.email, mobile: dto.mobile };
}

/**
 * Function toNotificationPreferences
 *
 * @description
 * Maps the gateway's preferences to the display model, event by event.
 *
 * @param {NotificationPreferencesDto} dto - The preferences as the gateway answers them.
 * @returns {NotificationPreferences} The preferences.
 */
export function toNotificationPreferences(
  dto: NotificationPreferencesDto,
): NotificationPreferences {
  return {
    channels: {
      mention: toChannels(dto.channels.mention),
      assignment: toChannels(dto.channels.assignment),
      comment: toChannels(dto.channels.comment),
      statusChange: toChannels(dto.channels.statusChange),
      dueDate: toChannels(dto.channels.dueDate),
      access: toChannels(dto.channels.access),
      billing: toChannels(dto.channels.billing),
    },
    digest: dto.digest,
    doNotDisturb: dto.doNotDisturb,
    version: dto.version,
  };
}

/**
 * Function toNotificationPreferencesPatch
 *
 * @description
 * The JSON Merge Patch of one changed setting: only that flag or value is sent, so the other
 * settings keep their recorded values.
 *
 * @param {NotificationPreferenceChange} change - The changed setting.
 * @returns {NotificationPreferencesPatch} The patch.
 */
export function toNotificationPreferencesPatch(
  change: NotificationPreferenceChange,
): NotificationPreferencesPatch {
  switch (change.kind) {
    case 'channel':
      return { channels: { [change.event]: { [change.channel]: change.enabled } } };
    case 'digest':
      return { digest: change.digest };
    case 'doNotDisturb':
      return { doNotDisturb: change.enabled };
  }
}

/**
 * Function isUncertainWrite
 *
 * @description
 * Whether a failed write may still have been recorded: no answer (no HTTP status, offline, a
 * timeout or any failure that is not a gateway answer) or a server failure (`5xx`), unlike a
 * refusal (`4xx`), which recorded nothing.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether its outcome is unknown.
 */
export function isUncertainWrite(error: unknown): boolean {
  const problem: ApiProblem | null = readProblem(error);
  return problem === null || problem.status === 0 || problem.status >= 500;
}

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` header of a preferences version.
 *
 * @param {number} version - The version.
 * @returns {Record<string, string>} The header.
 */
function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${String(version)}"` };
}

/**
 * Service NotificationPreferencesApi
 *
 * @description
 * The account's notification preferences through `NotificationPreferencesService`
 * (`GET` and `PATCH /v1/me/notification-preferences`): session only, the same for every
 * organization. It rejects with the gateway's `HttpErrorResponse`.
 */
@Service()
export class NotificationPreferencesApi {
  // #region Properties
  /**
   * Property preferences
   *
   * @description
   * Generated notification preference operations.
   *
   * @type {NotificationPreferencesService}
   * @readonly
   */
  private readonly preferences: NotificationPreferencesService = inject(
    NotificationPreferencesService,
  );
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the preferences: the section's primary read. Before the first change the gateway
   * answers its defaults at version 1.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<NotificationPreferences>} The preferences.
   */
  public async read(signal?: AbortSignal): Promise<NotificationPreferences> {
    signal?.throwIfAborted();
    const source: Observable<NotificationPreferencesDto> =
      this.preferences.getNotificationPreferences();
    const dto: NotificationPreferencesDto = await firstValueFrom(
      signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source,
    );
    return toNotificationPreferences(dto);
  }

  /**
   * Method change
   *
   * @description
   * Saves one setting against the version it was changed from (`If-Match`). When another tab or
   * device changed the preferences first (`412 request.version-mismatch`), it reads them again
   * and sends the same setting once more against their new version: the patch carries only that
   * setting, so the other changes are kept.
   *
   * @param {NotificationPreferenceChange} change - The changed setting.
   * @param {number} version - Version it was changed from.
   * @returns {Promise<NotificationPreferences>} The recorded preferences.
   */
  public async change(
    change: NotificationPreferenceChange,
    version: number,
  ): Promise<NotificationPreferences> {
    const patch: NotificationPreferencesPatch = toNotificationPreferencesPatch(change);
    try {
      return toNotificationPreferences(await this.update(patch, version));
    } catch (error: unknown) {
      if (!hasProblemCode(error, 'request.version-mismatch')) throw error;
      const fresh: NotificationPreferences = await this.read();
      return toNotificationPreferences(await this.update(patch, fresh.version));
    }
  }

  /**
   * Method update
   *
   * @description
   * Sends a patch against a version.
   *
   * @param {NotificationPreferencesPatch} patch - The patch.
   * @param {number} version - Version it was made from.
   * @returns {Promise<NotificationPreferencesDto>} The gateway's answer.
   */
  private update(
    patch: NotificationPreferencesPatch,
    version: number,
  ): Promise<NotificationPreferencesDto> {
    return firstValueFrom(
      this.preferences.updateNotificationPreferences(patch, { headers: ifMatch(version) }),
    );
  }
  // #endregion
}
