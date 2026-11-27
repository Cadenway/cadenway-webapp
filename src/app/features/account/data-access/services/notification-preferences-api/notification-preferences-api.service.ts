import { inject, Service } from '@angular/core';
import {
  AuthService,
  type CurrentUser,
  type NotificationChannelSettings,
  type NotificationPreferences as NotificationPreferencesDto,
  type NotificationPreferencesPatch,
  NotificationPreferencesService,
} from '@cadenway/api-client';
import { defer, firstValueFrom } from 'rxjs';

import { type ApiProblem, hasProblemCode, readProblem } from '@core/api';
import { withSessionLock } from '@features/auth';

import type {
  NotificationChannels,
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../../models/notification-preferences/notification-preferences.interface';
import { AccountChangedError } from './account-changed.error';
import { WriteNotSentError } from './write-not-sent.error';

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
 * settings keep their recorded values, and sending it twice records the same preferences.
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
 * Whether a failed write may still have been recorded: it was sent and got no answer (no HTTP
 * status, a timeout, any failure that is not a gateway answer) or a server failure (`5xx`),
 * unlike a refusal (`4xx`) or a write that never left (`WriteNotSentError`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether its outcome is unknown.
 */
export function isUncertainWrite(error: unknown): boolean {
  if (error instanceof WriteNotSentError || error instanceof AccountChangedError) return false;
  const problem: ApiProblem | null = readProblem(error);
  return problem === null || problem.status === 0 || problem.status >= 500;
}

/**
 * Function isVersionMismatch
 *
 * @description
 * Whether a write was refused because the preferences changed since its version
 * (`412 request.version-mismatch`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the version was stale.
 */
export function isVersionMismatch(error: unknown): boolean {
  return hasProblemCode(error, 'request.version-mismatch');
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
 * (`GET` and `PATCH /v1/me/notification-preferences`, session only, the same for every
 * organization). The preferences belong to whoever holds the browser session, so every request
 * first checks, with `AuthService.getCurrentUser`, that the session still belongs to the account
 * it is made for, and runs under the cross-tab session lock that sign-in and sign-out take: no
 * other account can sign in between the check and the request. A request for an account that is
 * no longer signed in rejects with `AccountChangedError` and sends nothing. Other failures reject
 * with the gateway's `HttpErrorResponse`; a write stopped before its patch left rejects with
 * `WriteNotSentError`.
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

  /**
   * Property auth
   *
   * @description
   * Generated account operations, for the identity of the session.
   *
   * @type {AuthService}
   * @readonly
   */
  private readonly auth: AuthService = inject(AuthService);
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the preferences of an account, under the shared session lock. Before the first change
   * the gateway answers its defaults at version 1.
   *
   * @param {string} userId - The account they are read for.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<NotificationPreferences>} The preferences.
   */
  public async read(userId: string, signal?: AbortSignal): Promise<NotificationPreferences> {
    signal?.throwIfAborted();
    const read: Promise<NotificationPreferences> = firstValueFrom(
      withSessionLock(
        () =>
          defer(async (): Promise<NotificationPreferences> => {
            await this.assertAccount(userId);
            return toNotificationPreferences(
              await firstValueFrom(this.preferences.getNotificationPreferences()),
            );
          }),
        'shared',
      ),
    );
    if (!signal) return read;
    return Promise.race([
      read,
      new Promise<never>((_resolve: (value: never) => void, reject: (reason: unknown) => void) => {
        signal.addEventListener(
          'abort',
          (): void => {
            reject(new DOMException('The read was cancelled.', 'AbortError'));
          },
          { once: true },
        );
      }),
    ]);
  }

  /**
   * Method write
   *
   * @description
   * Saves one setting of an account against the version it was changed from (`If-Match`), under
   * the exclusive session lock. A stale version is refused with
   * `412 request.version-mismatch` (`isVersionMismatch`).
   *
   * @param {NotificationPreferenceChange} change - The changed setting.
   * @param {number} version - Version it was changed from.
   * @param {string} userId - The account it is saved for.
   * @returns {Promise<NotificationPreferences>} The recorded preferences.
   */
  public async write(
    change: NotificationPreferenceChange,
    version: number,
    userId: string,
  ): Promise<NotificationPreferences> {
    const patch: NotificationPreferencesPatch = toNotificationPreferencesPatch(change);
    const progress: { sent: boolean } = { sent: false };
    try {
      return await firstValueFrom(
        withSessionLock(() =>
          defer(async (): Promise<NotificationPreferences> => {
            await this.assertAccount(userId);
            progress.sent = true;
            return toNotificationPreferences(
              await firstValueFrom(
                this.preferences.updateNotificationPreferences(patch, {
                  headers: ifMatch(version),
                }),
              ),
            );
          }),
        ),
      );
    } catch (error: unknown) {
      if (progress.sent || error instanceof AccountChangedError) throw error;
      throw new WriteNotSentError(error);
    }
  }

  /**
   * Method assertAccount
   *
   * @description
   * Checks that the browser session belongs to an account: it rejects with
   * `AccountChangedError` when another account holds it or none does (`401`), and with the
   * failure itself when the check could not be made.
   *
   * @param {string} userId - The expected account.
   * @returns {Promise<void>} Resolves when the session is that account's.
   */
  private async assertAccount(userId: string): Promise<void> {
    let user: CurrentUser;
    try {
      user = await firstValueFrom(this.auth.getCurrentUser());
    } catch (error: unknown) {
      if (readProblem(error)?.status === 401) throw new AccountChangedError(error);
      throw error;
    }
    if (user.id !== userId) throw new AccountChangedError();
  }
  // #endregion
}
