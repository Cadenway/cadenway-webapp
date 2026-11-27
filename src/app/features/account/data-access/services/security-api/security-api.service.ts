import { inject, Service } from '@angular/core';
import {
  AccountService,
  AuthService,
  type AuthenticatorAppConfigured,
  type CurrentUser,
  type OpenSession,
  type OpenSessionPage,
  type SecurityKeyAttestation,
  type SecurityKeyRegistration as SecurityKeyRegistrationDto,
  SessionsService,
  type TwoStepVerification,
  TwoStepVerificationService,
} from '@cadenway/api-client';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { defer, firstValueFrom } from 'rxjs';

import { readProblem } from '@core/api';
import { withSessionLock } from '@features/auth';

import type { AccountSession } from '../../../models/session/session.interface';
import type { SecurityOverview } from '../../../models/two-step/security-overview.interface';
import type {
  AuthenticatorConfirmation,
  AuthenticatorSetup,
  BackupCodeSet,
  SecurityKey,
} from '../../../models/two-step/two-step.interface';
import { orderSessions, toAccountSession } from '../../adapters/session/session.adapter';
import {
  toBackupCodeSet,
  toSecurityKey,
  toTwoStepOverview,
} from '../../adapters/two-step/two-step.adapter';
import { AccountChangedError } from '../notification-preferences-api/account-changed.error';
import { WriteNotSentError } from '../notification-preferences-api/write-not-sent.error';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Sessions asked for per page, the contract's maximum.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Constant MAX_PAGES
 *
 * @description
 * Pages read at most for the session list, a bound against a cursor that never ends.
 *
 * @type {number}
 */
const MAX_PAGES: number = 20;

/**
 * Class IncompleteSessionListError
 *
 * @description
 * The gateway's cursor did not end within `MAX_PAGES` pages, or came back to a page already read:
 * the read fails rather than show part of the sessions.
 */
export class IncompleteSessionListError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error.
   *
   * @constructor
   */
  public constructor() {
    super('The session list did not end.');
    this.name = 'IncompleteSessionListError';
  }
  // #endregion
}

/**
 * Service SecurityApi
 *
 * @description
 * The account feature's access to the `Security and sign-in` operations of `auth.yaml`
 * (`AuthService.getCurrentUser`, `AccountService.changePassword`, `TwoStepVerificationService`
 * and `SessionsService`), mapped to display models. Every call is bound to the account the page
 * shows: it first checks the session's account (`getCurrentUser`) under the session lock that
 * sign-in and sign-out take (shared for the read, exclusive for a write) and rejects with
 * `AccountChangedError` when another account, or none (`401`), holds the session, so nothing is
 * read from or sent to another account. Passwords, codes and secrets pass through in memory only
 * and are never logged. Guarded operations reject with `403 auth.reauthentication-required`,
 * which the caller handles.
 */
@Service()
export class SecurityApi {
  // #region Properties
  /**
   * Property auth
   *
   * @description
   * Generated auth operations, for the session's account.
   *
   * @type {AuthService}
   * @readonly
   */
  private readonly auth: AuthService = inject(AuthService);

  /**
   * Property account
   *
   * @description
   * Generated account operations, for the password.
   *
   * @type {AccountService}
   * @readonly
   */
  private readonly account: AccountService = inject(AccountService);

  /**
   * Property twoStep
   *
   * @description
   * Generated two-step verification operations.
   *
   * @type {TwoStepVerificationService}
   * @readonly
   */
  private readonly twoStep: TwoStepVerificationService = inject(TwoStepVerificationService);

  /**
   * Property sessions
   *
   * @description
   * Generated session operations.
   *
   * @type {SessionsService}
   * @readonly
   */
  private readonly sessions: SessionsService = inject(SessionsService);
  // #endregion

  // #region Methods
  /**
   * Method overview
   *
   * @description
   * Reads the section at once: the account (address and password date), its two-step
   * verification and every open session, following the cursor. It rejects rather than return
   * part of the sessions, and stops when the signal aborts.
   *
   * @param {string} userId - The account the page shows.
   * @param {AbortSignal} [signal] - Aborts the read when the page no longer needs it.
   * @returns {Promise<SecurityOverview>} The section's data.
   * @throws {AccountChangedError} When another account holds the session.
   * @throws {IncompleteSessionListError} When the session cursor does not end.
   */
  public async overview(userId: string, signal?: AbortSignal): Promise<SecurityOverview> {
    signal?.throwIfAborted();
    return firstValueFrom(
      withSessionLock(
        () =>
          defer(async (): Promise<SecurityOverview> => {
            const user: CurrentUser = await this.assertAccount(userId);
            const [twoStep, sessions]: [TwoStepVerification, AccountSession[]] = await Promise.all([
              firstValueFrom(this.twoStep.getTwoStepVerification()),
              this.allSessions(signal),
            ]);
            return {
              email: user.email,
              passwordChangedAt: user.passwordChangedAt ?? null,
              twoStep: toTwoStepOverview(twoStep),
              sessions: orderSessions(sessions),
            };
          }),
        'shared',
      ),
    );
  }

  /**
   * Method changePassword
   *
   * @description
   * Changes the password; the other sessions stay open.
   *
   * @param {string} userId - The account the page shows.
   * @param {string} currentPassword - The current password.
   * @param {string} newPassword - The new password, 12 characters at least.
   * @returns {Promise<string | null>} When the password was set, or null when not said.
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<string | null> {
    const user: CurrentUser = await this.locked(userId, () =>
      firstValueFrom(this.account.changePassword({ currentPassword, newPassword })),
    );
    return user.passwordChangedAt ?? null;
  }

  /**
   * Method startAuthenticatorSetup
   *
   * @description
   * Starts setting up (or replacing) the authenticator app; nothing changes until a code
   * confirms it. The secret is returned once.
   *
   * @param {string} userId - The account the page shows.
   * @returns {Promise<AuthenticatorSetup>} The pending setup.
   */
  public async startAuthenticatorSetup(userId: string): Promise<AuthenticatorSetup> {
    const setup: { secret: string } = await this.locked(userId, () =>
      firstValueFrom(this.twoStep.startAuthenticatorAppSetup({})),
    );
    return { secret: setup.secret };
  }

  /**
   * Method confirmAuthenticatorSetup
   *
   * @description
   * Confirms the pending app with one of its codes.
   *
   * @param {string} userId - The account the page shows.
   * @param {string} code - The 6 digits the app shows.
   * @returns {Promise<AuthenticatorConfirmation>} The new state and the first backup codes.
   */
  public async confirmAuthenticatorSetup(
    userId: string,
    code: string,
  ): Promise<AuthenticatorConfirmation> {
    const answer: AuthenticatorAppConfigured = await this.locked(userId, () =>
      firstValueFrom(this.twoStep.confirmAuthenticatorAppSetup({ code })),
    );
    return {
      twoStep: toTwoStepOverview(answer.twoStepVerification),
      backupCodes: answer.backupCodes === null ? null : toBackupCodeSet(answer.backupCodes),
    };
  }

  /**
   * Method disableTwoStep
   *
   * @description
   * Turns two-step verification off, deleting the app, the keys and the backup codes.
   *
   * @param {string} userId - The account the page shows.
   * @returns {Promise<void>} Resolves once it is off.
   */
  public async disableTwoStep(userId: string): Promise<void> {
    await this.locked(userId, () => firstValueFrom(this.twoStep.disableTwoStepVerification()));
  }

  /**
   * Method regenerateBackupCodes
   *
   * @description
   * Replaces the backup codes with 10 new ones, returned once.
   *
   * @param {string} userId - The account the page shows.
   * @returns {Promise<BackupCodeSet>} The new codes.
   */
  public async regenerateBackupCodes(userId: string): Promise<BackupCodeSet> {
    return toBackupCodeSet(
      await this.locked(userId, () => firstValueFrom(this.twoStep.regenerateBackupCodes({}))),
    );
  }

  /**
   * Method startSecurityKeyRegistration
   *
   * @description
   * Asks for the WebAuthn options of a new key, valid 5 minutes.
   *
   * @param {string} userId - The account the page shows.
   * @returns {Promise<PublicKeyCredentialCreationOptionsJSON>} The options for the browser.
   */
  public async startSecurityKeyRegistration(
    userId: string,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const registration: SecurityKeyRegistrationDto = await this.locked(userId, () =>
      firstValueFrom(this.twoStep.startSecurityKeyRegistration({})),
    );
    return registration.options as unknown as PublicKeyCredentialCreationOptionsJSON;
  }

  /**
   * Method addSecurityKey
   *
   * @description
   * Registers the key the browser created, under its name.
   *
   * @param {string} userId - The account the page shows.
   * @param {string} name - The trimmed name, 1 to 60 characters.
   * @param {RegistrationResponseJSON} credential - The browser's answer.
   * @returns {Promise<SecurityKey>} The registered key.
   */
  public async addSecurityKey(
    userId: string,
    name: string,
    credential: RegistrationResponseJSON,
  ): Promise<SecurityKey> {
    return toSecurityKey(
      await this.locked(userId, () =>
        firstValueFrom(
          this.twoStep.addSecurityKey({
            name,
            credential: credential as unknown as SecurityKeyAttestation,
          }),
        ),
      ),
    );
  }

  /**
   * Method removeSecurityKey
   *
   * @description
   * Removes a key of the account.
   *
   * @param {string} userId - The account the page shows.
   * @param {string} keyId - The key.
   * @returns {Promise<void>} Resolves once it is removed.
   */
  public async removeSecurityKey(userId: string, keyId: string): Promise<void> {
    await this.locked(userId, () => firstValueFrom(this.twoStep.removeSecurityKey(keyId)));
  }

  /**
   * Method revokeSession
   *
   * @description
   * Closes another session of the account.
   *
   * @param {string} userId - The account the page shows.
   * @param {string} sessionId - The session.
   * @returns {Promise<void>} Resolves once it is closed.
   */
  public async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.locked(userId, () => firstValueFrom(this.sessions.revokeSession(sessionId)));
  }

  /**
   * Method revokeOtherSessions
   *
   * @description
   * Closes every session of the account except this browser's.
   *
   * @param {string} userId - The account the page shows.
   * @returns {Promise<number>} How many sessions closed.
   */
  public async revokeOtherSessions(userId: string): Promise<number> {
    const answer: { revokedCount: number } = await this.locked(userId, () =>
      firstValueFrom(this.sessions.revokeOtherSessions({})),
    );
    return answer.revokedCount;
  }

  /**
   * Method locked
   *
   * @description
   * Runs a write under the exclusive session lock, once the session's account is checked. A
   * failure before the write itself was sent (the lock, the account check) rejects with
   * `WriteNotSentError`, so a caller never takes it for a lost answer of the write.
   *
   * @param {string} userId - The account the page shows.
   * @param {() => Promise<T>} send - The write.
   * @returns {Promise<T>} The write's answer.
   * @throws {AccountChangedError} When another account, or none, holds the session.
   * @throws {WriteNotSentError} When the write could not be sent.
   */
  private async locked<T>(userId: string, send: () => Promise<T>): Promise<T> {
    const progress: { sent: boolean } = { sent: false };
    try {
      return await firstValueFrom(
        withSessionLock(() =>
          defer(async (): Promise<T> => {
            await this.assertAccount(userId);
            progress.sent = true;
            return send();
          }),
        ),
      );
    } catch (error: unknown) {
      if (progress.sent || error instanceof AccountChangedError) throw error;
      throw new WriteNotSentError(error);
    }
  }

  /**
   * Method allSessions
   *
   * @description
   * Reads every page of the open sessions.
   *
   * @param {AbortSignal} [signal] - Stops between pages when aborted.
   * @returns {Promise<AccountSession[]>} The sessions in the gateway's order.
   * @throws {IncompleteSessionListError} When the cursor does not end within 20 pages or repeats.
   */
  private async allSessions(signal?: AbortSignal): Promise<AccountSession[]> {
    const sessions: AccountSession[] = [];
    const seen: Set<string> = new Set<string>();
    let cursor: string | undefined;
    for (let page: number = 0; page < MAX_PAGES; page++) {
      signal?.throwIfAborted();
      const answer: OpenSessionPage = await firstValueFrom(
        this.sessions.listSessions(
          cursor === undefined ? { limit: PAGE_SIZE } : { cursor, limit: PAGE_SIZE },
        ),
      );
      sessions.push(
        ...answer.items.map((item: OpenSession): AccountSession => toAccountSession(item)),
      );
      const next: string | null = answer.nextCursor;
      if (next === null) return sessions;
      if (seen.has(next)) throw new IncompleteSessionListError();
      seen.add(next);
      cursor = next;
    }
    throw new IncompleteSessionListError();
  }

  /**
   * Method assertAccount
   *
   * @description
   * Checks that the session belongs to the account the page shows.
   *
   * @param {string} userId - The account the page shows.
   * @returns {Promise<CurrentUser>} The session's account.
   * @throws {AccountChangedError} When another account, or none, holds the session.
   */
  private async assertAccount(userId: string): Promise<CurrentUser> {
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
