import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  AccountService,
  AuthService,
  type CurrentUser,
  type MyOrganizationPage,
  OrganizationsService,
  ProfileMediaService,
} from '@cadenway/api-client';
import { defer, firstValueFrom, fromEvent, NEVER, type Observable, takeUntil } from 'rxjs';

import { readProblem, REUSE_READ_WITHIN_MS } from '@core/api';
import { withSessionLock } from '@features/auth';

import type {
  AccountProfile,
  AvatarUpload,
  EmailChangeCode,
  MyOrganization,
  ProfileChange,
  ProfileField,
} from '../../../models/profile/profile.interface';
import {
  organizationIdsOf,
  refusedProfileFields,
  resendAvailableAtOf,
  toAccountProfile,
  toAvatarUpload,
  toEmailChangeCode,
  toMyOrganization,
  toProfilePatch,
} from '../../adapters/profile/profile.adapter';
import { AccountChangedError } from '../notification-preferences-api/account-changed.error';

/**
 * Constant MAX_ORGANIZATION_PAGES
 *
 * @description
 * The most pages of 100 organizations read for the account deletion; a cursor that does not end
 * within them fails the read rather than name part of the organizations.
 *
 * @type {number}
 */
const MAX_ORGANIZATION_PAGES: number = 20;

/**
 * Constant SESSION_READ_REUSE_MS
 *
 * @description
 * How old, in milliseconds, the workspace guard's account read may be for the profile's first
 * read to show it instead of reading the account again (`REUSE_READ_WITHIN_MS`): the guard runs
 * in the navigation that opens the page. Every write still checks the session afresh.
 *
 * @type {number}
 */
const SESSION_READ_REUSE_MS: number = 2000;

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` header of a change made from a version (`"3"`).
 *
 * @param {number} version - Version the change was made from.
 * @returns {{ readonly 'If-Match': string }} The header.
 */
function ifMatch(version: number): { readonly 'If-Match': string } {
  return { 'If-Match': `"${String(version)}"` };
}

/**
 * Service ProfileApi
 *
 * @description
 * The account feature's access to the profile of the signed-in account (`AuthService` and
 * `AccountService` of `openapi/public/auth.yaml`, the avatar operations of `ProfileMediaService`,
 * `openapi/public/profile-media.yaml`, and `OrganizationsService.listMyOrganizations` for the
 * account deletion), mapped to display models.
 *
 * Every request is bound to the account it is made for: the read and each write first check, under
 * Auth's cross-tab session lock (shared for the read, exclusive for a write), that the session
 * still belongs to that account (`getCurrentUser`), and reject with `AccountChangedError` without
 * sending anything otherwise (another account signed in, or none: `401`). The account writes need
 * no organization pin. The e-mail change request and the deletion answer
 * `403 auth.reauthentication-required` outside the 10-minute window; the caller runs them through
 * `ReauthenticationService`.
 */
@Service()
export class ProfileApi {
  // #region Properties
  /**
   * Property auth
   *
   * @description
   * Generated account read and profile change.
   *
   * @type {AuthService}
   * @readonly
   */
  private readonly auth: AuthService = inject(AuthService);

  /**
   * Property account
   *
   * @description
   * Generated e-mail change and deletion operations.
   *
   * @type {AccountService}
   * @readonly
   */
  private readonly account: AccountService = inject(AccountService);

  /**
   * Property media
   *
   * @description
   * Generated avatar operations.
   *
   * @type {ProfileMediaService}
   * @readonly
   */
  private readonly media: ProfileMediaService = inject(ProfileMediaService);

  /**
   * Property organizations
   *
   * @description
   * Generated list of the person's organizations.
   *
   * @type {OrganizationsService}
   * @readonly
   */
  private readonly organizations: OrganizationsService = inject(OrganizationsService);

  /**
   * Property http
   *
   * @description
   * Sends the photo bytes to the signed object-storage destination the gateway returns, without
   * application credentials; never used for the API itself.
   *
   * @type {HttpClient}
   * @readonly
   */
  private readonly http: HttpClient = inject(HttpClient);
  // #endregion

  // #region Methods
  /**
   * Method current
   *
   * @description
   * Reads the account of the session under the shared session lock, taking the workspace guard's
   * answer of the same navigation when it is at most `SESSION_READ_REUSE_MS` old. Aborting the
   * signal cancels the read.
   *
   * @param {string} userId - The account the page shows.
   * @param {AbortSignal} [signal] - Cancels the read.
   * @returns {Promise<AccountProfile>} The account.
   * @throws {AccountChangedError} When the session belongs to another account, or to none.
   */
  public async current(userId: string, signal?: AbortSignal): Promise<AccountProfile> {
    return this.boundRead(
      userId,
      (user: CurrentUser): Promise<AccountProfile> => Promise.resolve(toAccountProfile(user)),
      signal,
      SESSION_READ_REUSE_MS,
    );
  }

  /**
   * Method update
   *
   * @description
   * Changes the profile from the version it was read at. `400 request.invalid` refuses a field.
   *
   * @param {ProfileChange} change - What changes.
   * @param {number} version - Version the change was made from.
   * @param {string} userId - The account the change is made for.
   * @returns {Promise<AccountProfile>} The account after the change.
   */
  public async update(
    change: ProfileChange,
    version: number,
    userId: string,
  ): Promise<AccountProfile> {
    return this.bound(userId, async () =>
      toAccountProfile(
        await firstValueFrom(
          this.auth.updateCurrentUser(toProfilePatch(change), { headers: ifMatch(version) }),
        ),
      ),
    );
  }

  /**
   * Method refusedFields
   *
   * @description
   * The form fields a `400 request.invalid` refusal of `update` names in its issues.
   *
   * @param {unknown} error - The refusal.
   * @returns {readonly ProfileField[]} The refused fields, each once; none for another error.
   */
  public refusedFields(error: unknown): readonly ProfileField[] {
    return refusedProfileFields(readProblem(error)?.details ?? null);
  }

  /**
   * Method resendAvailableAt
   *
   * @description
   * When another code can be asked for, from a `429 auth.code-throttled` refusal of
   * `requestEmailChange` (`details.resendAvailableAt`).
   *
   * @param {unknown} error - The refusal.
   * @returns {number | null} Milliseconds since the epoch, or null when the refusal does not say.
   */
  public resendAvailableAt(error: unknown): number | null {
    return resendAvailableAtOf(readProblem(error)?.details ?? null);
  }

  /**
   * Method ownedOrganizationIds
   *
   * @description
   * The organizations a `409 account.organization-owner` refusal of `scheduleDeletion` lists
   * (`details.organizationIds`).
   *
   * @param {unknown} error - The refusal.
   * @returns {readonly string[]} The organization ids; none when the refusal does not list them.
   */
  public ownedOrganizationIds(error: unknown): readonly string[] {
    return organizationIdsOf(readProblem(error)?.details ?? null);
  }

  /**
   * Method avatar
   *
   * @description
   * Reads the image of the current photo, a PNG whatever was uploaded; `404 media.not-found`
   * without one. Like `current`, it runs under the shared session lock once the session is
   * checked to hold the account. Aborting the signal cancels the request, and the promise rejects
   * with the signal's reason.
   *
   * @param {string} userId - The account whose photo is read.
   * @param {AbortSignal} [signal] - Cancels the read.
   * @returns {Promise<Blob>} The image.
   * @throws {AccountChangedError} When the session belongs to another account, or to none.
   */
  public async avatar(userId: string, signal?: AbortSignal): Promise<Blob> {
    return this.boundRead(
      userId,
      async (): Promise<Blob> => {
        const image: Blob | null = await firstValueFrom(this.media.getAvatar(), {
          defaultValue: null,
        });
        if (image === null) throw new Error('The photo read ended without an image.');
        return image;
      },
      signal,
    );
  }

  /**
   * Method reserveAvatar
   *
   * @description
   * Reserves the upload of a photo with a fresh `Idempotency-Key`.
   *
   * @param {File} file - A PNG, JPEG or WebP image of at most 5 MiB.
   * @param {string} userId - The account the photo is for.
   * @returns {Promise<AvatarUpload>} The signed destination.
   */
  public async reserveAvatar(file: File, userId: string): Promise<AvatarUpload> {
    const contentType: 'image/png' | 'image/jpeg' | 'image/webp' =
      file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/png';
    return this.bound(userId, async () =>
      toAvatarUpload(
        await firstValueFrom(
          this.media.startAvatarUpload(
            { contentType, sizeBytes: file.size },
            { headers: { 'Idempotency-Key': crypto.randomUUID() } },
          ),
        ),
      ),
    );
  }

  /**
   * Method sendAvatar
   *
   * @description
   * Sends the image to its signed destination: every signed field unchanged, then the file.
   *
   * @param {AvatarUpload} upload - The reservation.
   * @param {File} file - The image reserved for.
   * @returns {Promise<void>} Resolves once storage accepted the transfer.
   */
  public async sendAvatar(upload: AvatarUpload, file: File): Promise<void> {
    const body: FormData = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
    body.append('file', file);
    await firstValueFrom(this.http.post(upload.url, body, { responseType: 'text' }));
  }

  /**
   * Method publishAvatar
   *
   * @description
   * Publishes a sent image as the photo, from the account's version.
   *
   * @param {string} uploadId - The reservation.
   * @param {number} version - Version of the account.
   * @param {string} userId - The account the photo is for.
   * @returns {Promise<void>} Resolves once the photo is the account's.
   */
  public async publishAvatar(uploadId: string, version: number, userId: string): Promise<void> {
    await this.bound(userId, () =>
      firstValueFrom(this.media.setAvatar({ uploadId }, { headers: ifMatch(version) })),
    );
  }

  /**
   * Method removeAvatar
   *
   * @description
   * Removes the photo, from the account's version.
   *
   * @param {number} version - Version of the account.
   * @param {string} userId - The account the photo is removed from.
   * @returns {Promise<void>} Resolves once the account has no photo.
   */
  public async removeAvatar(version: number, userId: string): Promise<void> {
    await this.bound(userId, () =>
      firstValueFrom(this.media.deleteAvatar({ headers: ifMatch(version) })),
    );
  }

  /**
   * Method requestEmailChange
   *
   * @description
   * Sends a 6-digit code to a new address; asking again for the same address resends it.
   * `422 auth.email-unchanged`, `409 auth.email-taken`, `429 auth.code-throttled` and
   * `403 auth.reauthentication-required` refuse it.
   *
   * @param {string} email - The new address.
   * @param {string} userId - The account whose address changes.
   * @returns {Promise<EmailChangeCode>} Where the code went and when another can be asked for.
   */
  public async requestEmailChange(email: string, userId: string): Promise<EmailChangeCode> {
    return this.bound(userId, async () =>
      toEmailChangeCode(await firstValueFrom(this.account.requestEmailChange({ email }))),
    );
  }

  /**
   * Method confirmEmailChange
   *
   * @description
   * Confirms the new address with its code. `422 auth.code-invalid` or `auth.code-expired` refuse
   * the code, `409 auth.email-taken` drops the change.
   *
   * @param {string} code - The 6 digits, without a space.
   * @param {string} userId - The account whose address changes.
   * @returns {Promise<AccountProfile>} The account with its new address.
   */
  public async confirmEmailChange(code: string, userId: string): Promise<AccountProfile> {
    return this.bound(userId, async () =>
      toAccountProfile(await firstValueFrom(this.account.confirmEmailChange({ code }))),
    );
  }

  /**
   * Method scheduleDeletion
   *
   * @description
   * Schedules the deletion of the account in 30 days, which revokes every session, this one
   * included. `409 account.organization-owner` and `403 auth.reauthentication-required` refuse
   * it.
   *
   * @param {string} userId - The account to delete.
   * @returns {Promise<void>} Resolves once the deletion is scheduled.
   */
  public async scheduleDeletion(userId: string): Promise<void> {
    await this.bound(userId, () => firstValueFrom(this.account.scheduleAccountDeletion({})));
  }

  /**
   * Method myOrganizations
   *
   * @description
   * Reads every organization of the person, following the cursor, under the shared session lock
   * once the session is checked to hold the account.
   *
   * @param {string} userId - The account whose organizations are read.
   * @returns {Promise<readonly MyOrganization[]>} The organizations, in the gateway's order.
   * @throws {AccountChangedError} When the session belongs to another account, or to none.
   * @throws {Error} When the cursor does not end within `MAX_ORGANIZATION_PAGES` pages or repeats.
   */
  public async myOrganizations(userId: string): Promise<readonly MyOrganization[]> {
    return this.boundRead(userId, () => this.organizationPages());
  }

  /**
   * Method organizationPages
   *
   * @description
   * Reads every page of the person's organizations, following the cursor.
   *
   * @returns {Promise<readonly MyOrganization[]>} The organizations, in the gateway's order.
   * @throws {Error} When the cursor does not end within `MAX_ORGANIZATION_PAGES` pages or repeats.
   */
  private async organizationPages(): Promise<readonly MyOrganization[]> {
    const organizations: MyOrganization[] = [];
    const seen: Set<string> = new Set<string>();
    let cursor: string | undefined;
    for (let page: number = 0; page < MAX_ORGANIZATION_PAGES; page += 1) {
      const answer: MyOrganizationPage = await firstValueFrom(
        this.organizations.listMyOrganizations({ limit: 100, ...(cursor ? { cursor } : {}) }),
      );
      organizations.push(...answer.items.map(toMyOrganization));
      const next: string | null = answer.nextCursor;
      if (next === null) return organizations;
      if (seen.has(next)) break;
      seen.add(next);
      cursor = next;
    }
    throw new Error('The organizations could not be read to the end.');
  }

  /**
   * Method boundRead
   *
   * @description
   * Runs a read under the shared session lock once the session is checked to belong to the
   * account it is made for. Aborting the signal cancels it, and the promise rejects with the
   * signal's reason.
   *
   * @template T
   * @param {string} userId - The account the read is made for.
   * @param {(user: CurrentUser) => Promise<T>} read - The request, given the session's account.
   * @param {AbortSignal} [signal] - Cancels the read.
   * @param {number} [reuseWithinMs] - How old a kept account answer may be to check the session.
   * @returns {Promise<T>} The request's result.
   * @throws {AccountChangedError} When the session belongs to another account, or to none.
   */
  private async boundRead<T>(
    userId: string,
    read: (user: CurrentUser) => Promise<T>,
    signal?: AbortSignal,
    reuseWithinMs: number = 0,
  ): Promise<T> {
    signal?.throwIfAborted();
    const aborted: Observable<Event> = signal === undefined ? NEVER : fromEvent(signal, 'abort');
    const answer: { readonly value: T } | null = await firstValueFrom(
      withSessionLock(
        () =>
          defer(async (): Promise<{ readonly value: T }> => {
            const user: CurrentUser = await this.sessionUser(reuseWithinMs);
            if (user.id !== userId) throw new AccountChangedError();
            return { value: await read(user) };
          }),
        'shared',
      ).pipe(takeUntil(aborted)),
      { defaultValue: null },
    );
    signal?.throwIfAborted();
    if (answer === null) throw new Error('The read ended without an answer.');
    return answer.value;
  }

  /**
   * Method bound
   *
   * @description
   * Runs a write under the exclusive session lock once the session is checked to belong to the
   * account it is made for.
   *
   * @template T
   * @param {string} userId - The account the write is made for.
   * @param {() => Promise<T>} write - The request.
   * @returns {Promise<T>} The request's result.
   * @throws {AccountChangedError} When the session belongs to another account, or to none.
   */
  private async bound<T>(userId: string, write: () => Promise<T>): Promise<T> {
    return firstValueFrom(
      withSessionLock(() =>
        defer(async (): Promise<T> => {
          const user: CurrentUser = await this.sessionUser();
          if (user.id !== userId) throw new AccountChangedError();
          return write();
        }),
      ),
    );
  }

  /**
   * Method sessionUser
   *
   * @description
   * Reads the account of the session; a `401` means the session holds no account.
   *
   * @param {number} [reuseWithinMs] - How old a kept answer may be (`REUSE_READ_WITHIN_MS`).
   * @returns {Promise<CurrentUser>} The account.
   * @throws {AccountChangedError} When the session holds no account.
   */
  private async sessionUser(reuseWithinMs: number = 0): Promise<CurrentUser> {
    try {
      return await firstValueFrom(
        this.auth.getCurrentUser({
          context: new HttpContext().set(REUSE_READ_WITHIN_MS, reuseWithinMs),
        }),
      );
    } catch (error: unknown) {
      if (readProblem(error)?.status === 401) throw new AccountChangedError(error);
      throw error;
    }
  }
  // #endregion
}
