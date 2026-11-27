import { inject, Service } from '@angular/core';
import { AuthService, type CurrentUser } from '@cadenway/api-client';
import { defer, firstValueFrom } from 'rxjs';

import { readProblem } from '@core/api';
import { withSessionLock } from '@features/auth';

import { AccountChangedError } from '../notification-preferences-api/account-changed.error';
import { WriteNotSentError } from '../notification-preferences-api/write-not-sent.error';
import type { AccountLanguage, AccountLanguageSettings } from './account-language.interface';

/**
 * Constant ACCOUNT_LANGUAGES
 *
 * @description
 * The languages `updateCurrentUser` accepts (`ProfilePatchLanguage` of `auth.yaml`).
 *
 * @type {readonly AccountLanguage[]}
 */
const ACCOUNT_LANGUAGES: readonly AccountLanguage[] = ['fr', 'en', 'de', 'es'];

/**
 * Function toAccountLanguageSettings
 *
 * @description
 * Maps the current user to the language the section shows. The account stores a BCP 47 tag: its
 * primary subtag is matched, case aside (`fr-FR` reads `fr`), and any other tag reads null.
 *
 * @param {CurrentUser} dto - The current user as the gateway answers it.
 * @returns {AccountLanguageSettings} The language and the account version.
 */
export function toAccountLanguageSettings(dto: CurrentUser): AccountLanguageSettings {
  const primary: string = dto.language.split('-')[0]?.toLowerCase() ?? '';
  const language: AccountLanguage | undefined = ACCOUNT_LANGUAGES.find(
    (candidate: AccountLanguage): boolean => candidate === primary,
  );
  return { language: language ?? null, version: dto.version };
}

/**
 * Service LanguageApi
 *
 * @description
 * The account's language through `AuthService` (`GET` and `PATCH /v1/me`, session only). The
 * language belongs to whoever holds the browser session, so, as for the notification
 * preferences, every request first checks with `getCurrentUser` that the session still belongs
 * to the account it is made for, under the cross-tab session lock that sign-in and sign-out take.
 * A request for an account that is no longer signed in rejects with `AccountChangedError` and
 * sends nothing. Other failures reject with the gateway's `HttpErrorResponse`; a write stopped
 * before its patch left rejects with `WriteNotSentError`.
 */
@Service()
export class LanguageApi {
  // #region Properties
  /**
   * Property auth
   *
   * @description
   * Generated account operations.
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
   * Reads the language of an account, under the shared session lock: the read of the current
   * user is also the account check.
   *
   * @param {string} userId - The account it is read for.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<AccountLanguageSettings>} The language and the account version.
   */
  public async read(userId: string, signal?: AbortSignal): Promise<AccountLanguageSettings> {
    signal?.throwIfAborted();
    const read: Promise<AccountLanguageSettings> = firstValueFrom(
      withSessionLock(
        () =>
          defer(async (): Promise<AccountLanguageSettings> =>
            toAccountLanguageSettings(await this.currentUser(userId)),
          ),
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
   * Saves the language of an account against the version it was changed from (`If-Match`), under
   * the exclusive session lock, as a merge patch holding the language alone. A stale version is
   * refused with `412 request.version-mismatch`.
   *
   * @param {AccountLanguage} language - The chosen language.
   * @param {number} version - Account version it was changed from.
   * @param {string} userId - The account it is saved for.
   * @returns {Promise<AccountLanguageSettings>} The recorded language and the new version.
   */
  public async write(
    language: AccountLanguage,
    version: number,
    userId: string,
  ): Promise<AccountLanguageSettings> {
    const progress: { sent: boolean } = { sent: false };
    try {
      return await firstValueFrom(
        withSessionLock(() =>
          defer(async (): Promise<AccountLanguageSettings> => {
            await this.currentUser(userId);
            progress.sent = true;
            return toAccountLanguageSettings(
              await firstValueFrom(
                this.auth.updateCurrentUser(
                  { language },
                  { headers: { 'If-Match': `"${String(version)}"` } },
                ),
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
   * Method currentUser
   *
   * @description
   * Reads the session's account and checks it is the expected one: it rejects with
   * `AccountChangedError` when another account holds the session or none does (`401`), and with
   * the failure itself when the read could not be made.
   *
   * @param {string} userId - The expected account.
   * @returns {Promise<CurrentUser>} The session's account.
   */
  private async currentUser(userId: string): Promise<CurrentUser> {
    let user: CurrentUser;
    try {
      user = await firstValueFrom(this.auth.getCurrentUser());
    } catch (error: unknown) {
      if (readProblem(error)?.status === 401) throw new AccountChangedError(error);
      throw error;
    }
    if (user.id !== userId) throw new AccountChangedError();
    return user;
  }
  // #endregion
}
