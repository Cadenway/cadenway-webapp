import {
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';

import { type ApiProblem, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import { SecurityApi } from '../../data-access/services/security-api/security-api.service';
import type { AccountSession } from '../../models/session/session.interface';
import type {
  BackupCodesOutcome,
  DisableOutcome,
  PasswordChangeOutcome,
  RemovalOutcome,
  RevokeOthersOutcome,
  SecurityAction,
  SecurityKeyAddOutcome,
  SecurityOverview,
  SecurityWriteEnd,
  SetupConfirmOutcome,
  SetupStartOutcome,
} from '../../models/two-step/security-overview.interface';
import type {
  AuthenticatorConfirmation,
  AuthenticatorSetup,
  BackupCodeSet,
  SecurityKey,
  TwoStepOverview,
} from '../../models/two-step/two-step.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';
import {
  isPromptDismissed,
  SecurityKeyRegistration,
} from '../../services/security-key-registration/security-key-registration.service';
import { SECURITY_REREAD_DELAYS } from './security-reread-delays.token';

/**
 * Interface SecurityState
 *
 * @description
 * What the store holds besides the read. It never holds a password, a code or a secret: a write
 * that brings one returns it to the page.
 */
interface SecurityState {
  // #region Properties
  /**
   * Property busy
   *
   * @description
   * The write under way (waiting for the gateway, the reauthentication dialog or the browser's
   * key prompt), or null.
   *
   * @type {SecurityAction | null}
   * @readonly
   */
  readonly busy: SecurityAction | null;

  /**
   * Property busyId
   *
   * @description
   * The key or session that write acts on, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly busyId: string | null;

  /**
   * Property sending
   *
   * @description
   * Whether a write is on its way to the gateway, which may still apply it. False while a write
   * only waits for the reauthentication dialog.
   *
   * @type {boolean}
   * @readonly
   */
  readonly sending: boolean;
  // #endregion
}

/**
 * Type Settled
 *
 * @description
 * What `perform` resolves with: the write's value, or how it ended without one.
 *
 * `uncertain` marks a failure whose answer was lost (no status, `408`, `5xx`), which the
 * gateway may still have applied; `applied` then says whether a section read again showed it.
 *
 * @type {{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly end: SecurityWriteEnd; readonly error: unknown; readonly uncertain: boolean; readonly applied: boolean }}
 */
type Settled<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly end: SecurityWriteEnd;
      readonly error: unknown;
      readonly uncertain: boolean;
      readonly applied: boolean;
    };

/**
 * Interface SecurityStoreInstance
 *
 * @description
 * The `Security and sign-in` section's state: its read and its writes.
 */
interface SecurityStoreInstance {
  // #region Properties
  /**
   * Property security
   *
   * @description
   * The section's primary read, keyed by the workspace's account: a rejection reaches the route's
   * error boundary. Writes apply their answers to it.
   *
   * @type {ResourceRef<SecurityOverview | undefined>}
   * @readonly
   */
  readonly security: ResourceRef<SecurityOverview | undefined>;

  /**
   * Property overview
   *
   * @description
   * The section's data, undefined while it is read; reading it after a failed read throws, which
   * the error boundary catches.
   *
   * @type {Signal<SecurityOverview | undefined>}
   * @readonly
   */
  readonly overview: Signal<SecurityOverview | undefined>;

  /**
   * Property keysSupported
   *
   * @description
   * Whether this browser can register security keys (WebAuthn).
   *
   * @type {boolean}
   * @readonly
   */
  readonly keysSupported: boolean;

  /**
   * Property busy
   *
   * @description
   * The write under way, or null.
   *
   * @type {Signal<SecurityAction | null>}
   * @readonly
   */
  readonly busy: Signal<SecurityAction | null>;

  /**
   * Property busyId
   *
   * @description
   * The key or session that write acts on, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly busyId: Signal<string | null>;

  /**
   * Property sending
   *
   * @description
   * Whether a write is on its way to the gateway.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly sending: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method sent
   *
   * @description
   * Waits for the write on its way to settle; resolves at once when none is.
   *
   * @returns {Promise<void>} Settles once nothing is on its way.
   */
  sent(): Promise<void>;

  /**
   * Method changePassword
   *
   * @description
   * Changes the password (through the reauthentication an account with two-step verification
   * needs) and shows its new date.
   *
   * @param {string} currentPassword - The current password.
   * @param {string} newPassword - The new password.
   * @returns {Promise<PasswordChangeOutcome>} How it ended.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<PasswordChangeOutcome>;

  /**
   * Method startSetup
   *
   * @description
   * Starts setting up the authenticator app, through the reauthentication; the key is returned to
   * show once, never kept here.
   *
   * @returns {Promise<SetupStartOutcome>} How it ended.
   */
  startSetup(): Promise<SetupStartOutcome>;

  /**
   * Method confirmSetup
   *
   * @description
   * Confirms the pending app with one of its codes and shows two-step verification on; the first
   * backup codes are returned to show once.
   *
   * @param {string} code - The 6 digits the app shows.
   * @returns {Promise<SetupConfirmOutcome>} How it ended.
   */
  confirmSetup(code: string): Promise<SetupConfirmOutcome>;

  /**
   * Method disable
   *
   * @description
   * Turns two-step verification off, through the reauthentication.
   *
   * @returns {Promise<DisableOutcome>} How it ended.
   */
  disable(): Promise<DisableOutcome>;

  /**
   * Method regenerateBackupCodes
   *
   * @description
   * Replaces the backup codes, through the reauthentication; the new codes are returned to show
   * once.
   *
   * @returns {Promise<BackupCodesOutcome>} How it ended.
   */
  regenerateBackupCodes(): Promise<BackupCodesOutcome>;

  /**
   * Method addSecurityKey
   *
   * @description
   * Registers a security key under a name: the gateway's options (through the reauthentication),
   * the browser's prompt, then the registration.
   *
   * @param {string} name - The trimmed name.
   * @returns {Promise<SecurityKeyAddOutcome>} How it ended.
   */
  addSecurityKey(name: string): Promise<SecurityKeyAddOutcome>;

  /**
   * Method removeSecurityKey
   *
   * @description
   * Removes a key, through the reauthentication.
   *
   * @param {SecurityKey} key - The key.
   * @returns {Promise<RemovalOutcome>} How it ended.
   */
  removeSecurityKey(key: SecurityKey): Promise<RemovalOutcome>;

  /**
   * Method revokeSession
   *
   * @description
   * Closes another session.
   *
   * @param {AccountSession} session - The session.
   * @returns {Promise<RemovalOutcome>} How it ended.
   */
  revokeSession(session: AccountSession): Promise<RemovalOutcome>;

  /**
   * Method revokeOtherSessions
   *
   * @description
   * Closes every session but this browser's.
   *
   * @returns {Promise<RevokeOthersOutcome>} How it ended.
   */
  revokeOtherSessions(): Promise<RevokeOthersOutcome>;
  // #endregion
}

/**
 * Constant CANCELLED
 *
 * @description
 * The end of a write that shows nothing.
 *
 * @type {SecurityWriteEnd}
 */
const CANCELLED: SecurityWriteEnd = { kind: 'cancelled' };

/**
 * Constant FAILED
 *
 * @description
 * The end of a refused or unanswered write.
 *
 * @type {SecurityWriteEnd}
 */
const FAILED: SecurityWriteEnd = { kind: 'failed' };

/**
 * Constant SKIPPED
 *
 * @description
 * The end of a write that did not start.
 *
 * @type {SecurityWriteEnd}
 */
const SKIPPED: SecurityWriteEnd = { kind: 'skipped' };

/**
 * Constant UNCONFIRMED
 *
 * @description
 * The end of a write whose answer was lost and that no read again showed: it may still have
 * been applied, or never was.
 *
 * @type {{ readonly kind: 'unconfirmed' }}
 */
const UNCONFIRMED: { readonly kind: 'unconfirmed' } = { kind: 'unconfirmed' };

/**
 * Function isUncertain
 *
 * @description
 * Whether a failed write may still have been applied: its answer was lost (no status), timed out
 * (`408`) or the gateway failed (`5xx`).
 *
 * @param {unknown} error - What the write rejected with.
 * @returns {boolean} Whether its outcome is unknown.
 */
function isUncertain(error: unknown): boolean {
  const status: number | undefined = readProblem(error)?.status;
  return status !== undefined && (status === 0 || status === 408 || status >= 500);
}

/**
 * Function isLater
 *
 * @description
 * Whether a moment read again is later than the one shown before.
 *
 * @param {string | null | undefined} fresh - The moment read again.
 * @param {string | null | undefined} before - The moment shown before.
 * @returns {boolean} Whether it moved forward.
 */
function isLater(fresh: string | null | undefined, before: string | null | undefined): boolean {
  if (fresh === null || fresh === undefined) return false;
  if (before === null || before === undefined) return true;
  return Date.parse(fresh) > Date.parse(before);
}

/**
 * Function codeOf
 *
 * @description
 * The problem code of a refusal, or null.
 *
 * @param {unknown} error - What the write rejected with.
 * @returns {string | null} The code.
 */
function codeOf(error: unknown): string | null {
  return readProblem(error)?.code ?? null;
}

/**
 * Function withTwoStepOff
 *
 * @description
 * The card once two-step verification is turned off: the gateway deleted the app, the keys and
 * the backup codes; the organizations' requirements stay as read.
 *
 * @param {TwoStepOverview} overview - The state before.
 * @returns {TwoStepOverview} The state after.
 */
function withTwoStepOff(overview: TwoStepOverview): TwoStepOverview {
  return {
    enabled: false,
    appIsPrimary: false,
    appConfiguredAt: null,
    securityKeys: [],
    backupCodes: null,
    requiredBy: overview.requiredBy,
  };
}

/**
 * Function withNewBackupCodes
 *
 * @description
 * The card once new backup codes replaced the previous ones: all of them unused.
 *
 * @param {TwoStepOverview} overview - The state before.
 * @param {BackupCodeSet} codes - The new codes.
 * @returns {TwoStepOverview} The state after.
 */
function withNewBackupCodes(overview: TwoStepOverview, codes: BackupCodeSet): TwoStepOverview {
  return {
    ...overview,
    backupCodes: {
      remaining: codes.codes.length,
      total: codes.codes.length,
      generatedAt: codes.generatedAt,
    },
  };
}

/**
 * Function createSecurityStore
 *
 * @description
 * Creates the security store.
 *
 * @returns {Type<SecurityStoreInstance>} Injectable store constructor.
 */
function createSecurityStore(): Type<SecurityStoreInstance> {
  return signalStore(
    withState<SecurityState>({ busy: null, busyId: null, sending: false }),
    withProps(() => {
      const api: SecurityApi = inject(SecurityApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return {
        security: resource({
          params: (): string => workspace.user().id,
          loader: ({
            params,
            abortSignal,
          }: {
            params: string;
            abortSignal: AbortSignal;
          }): Promise<SecurityOverview> => api.overview(params, abortSignal),
        }),
        keysSupported: inject(SecurityKeyRegistration).supported(),
      };
    }),
    withComputed((store) => ({
      overview: (): SecurityOverview | undefined => store.security.value(),
    })),
    withMethods(
      (
        store,
        api: SecurityApi = inject(SecurityApi),
        keys: SecurityKeyRegistration = inject(SecurityKeyRegistration),
        reauthentication: ReauthenticationService = inject(ReauthenticationService),
        workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT),
        destroyRef: DestroyRef = inject(DestroyRef),
        rereadDelays: readonly number[] = inject(SECURITY_REREAD_DELAYS),
      ) => {
        // Who waits in `sent()` for the write on its way.
        let waiters: (() => void)[] = [];
        const markSending: (sending: boolean) => void = (sending: boolean): void => {
          patchState(store, { sending });
          if (sending) return;
          const settled: (() => void)[] = waiters;
          waiters = [];
          for (const resolve of settled) resolve();
        };

        // Runs one write bound to the account shown when it starts and to the page: once either
        // changes, nothing more is sent (the retry after a reauthentication included) and its
        // answer is dropped. `step` stops between the parts of a write the same way. `applied`
        // tells whether a section read again shows the write; a lost answer is settled with it.
        const perform: <T>(
          action: SecurityAction,
          targetId: string | null,
          send: (userId: string, step: () => void) => Promise<T>,
          applied: ((fresh: SecurityOverview) => boolean) | null,
        ) => Promise<Settled<T>> = async <T>(
          action: SecurityAction,
          targetId: string | null,
          send: (userId: string, step: () => void) => Promise<T>,
          applied: ((fresh: SecurityOverview) => boolean) | null,
        ): Promise<Settled<T>> => {
          if (!store.security.hasValue() || store.busy() !== null) {
            return { ok: false, end: SKIPPED, error: null, uncertain: false, applied: false };
          }
          const userId: string = workspace.user().id;
          const abandoned: Error = new Error('The security write was abandoned.');
          const stillWanted: () => boolean = (): boolean =>
            !destroyRef.destroyed && workspace.user().id === userId;
          const step: () => void = (): void => {
            if (!stillWanted()) throw abandoned;
          };
          const cancelled: Settled<T> = {
            ok: false,
            end: CANCELLED,
            error: null,
            uncertain: false,
            applied: false,
          };
          patchState(store, { busy: action, busyId: targetId });
          try {
            // A sent write stays `sending` until its result is settled here, the rereads of a
            // lost answer included; a refusal applied nothing, so it ends `sending` at once (the
            // write may go on to the reauthentication dialog).
            const value: T = await reauthentication.run(async (): Promise<T> => {
              step();
              markSending(true);
              try {
                return await send(userId, step);
              } catch (error: unknown) {
                if (!isUncertain(error)) markSending(false);
                throw error;
              }
            });
            if (!stillWanted()) return cancelled;
            return { ok: true, value };
          } catch (error: unknown) {
            const silent: boolean =
              error === abandoned ||
              error instanceof ReauthenticationCancelledError ||
              error instanceof AccountChangedError ||
              !stillWanted();
            if (silent) return cancelled;
            if (!isUncertain(error) || applied === null) {
              return { ok: false, end: FAILED, error, uncertain: false, applied: false };
            }
            // The gateway may have applied the write, or may still apply it: read the section
            // again, outside the error boundary, at once and then after each delay, until a read
            // shows the write. Each read that answers replaces the one shown.
            for (const delay of rereadDelays) {
              if (delay > 0) {
                await new Promise<void>((resolve: () => void): void => {
                  setTimeout(resolve, delay);
                });
              }
              if (!stillWanted()) return cancelled;
              const fresh: SecurityOverview | null = await api
                .overview(userId)
                .catch((): null => null);
              if (!stillWanted()) return cancelled;
              if (fresh !== null) {
                store.security.set(fresh);
                if (applied(fresh)) {
                  return { ok: false, end: FAILED, error, uncertain: true, applied: true };
                }
              }
            }
            return { ok: false, end: FAILED, error, uncertain: true, applied: false };
          } finally {
            patchState(store, { busy: null, busyId: null });
            markSending(false);
          }
        };

        const apply: (change: (overview: SecurityOverview) => SecurityOverview) => void = (
          change: (overview: SecurityOverview) => SecurityOverview,
        ): void => {
          if (store.security.hasValue()) store.security.set(change(store.security.value()));
        };

        const shown: () => SecurityOverview | null = (): SecurityOverview | null =>
          store.security.hasValue() ? store.security.value() : null;

        return {
          sent(): Promise<void> {
            if (!store.sending()) return Promise.resolve();
            return new Promise<void>((resolve: () => void): void => {
              waiters.push(resolve);
            });
          },

          async changePassword(
            currentPassword: string,
            newPassword: string,
          ): Promise<PasswordChangeOutcome> {
            const before: string | null = shown()?.passwordChangedAt ?? null;
            const settled: Settled<string | null> = await perform(
              'password',
              null,
              (userId: string): Promise<string | null> =>
                api.changePassword(userId, currentPassword, newPassword),
              (fresh: SecurityOverview): boolean => isLater(fresh.passwordChangedAt, before),
            );
            if (settled.ok) {
              const changedAt: string | null = settled.value;
              apply((overview: SecurityOverview): SecurityOverview => ({
                ...overview,
                passwordChangedAt: changedAt ?? new Date().toISOString(),
              }));
              return { kind: 'saved' };
            }
            if (settled.end.kind !== 'failed') return settled.end;
            if (settled.uncertain) return settled.applied ? { kind: 'saved' } : UNCONFIRMED;
            const problem: ApiProblem | null = readProblem(settled.error);
            switch (problem?.code) {
              case 'auth.password-incorrect': {
                const remaining: unknown = problem.details?.['remainingAttempts'];
                return {
                  kind: 'password-incorrect',
                  remainingAttempts:
                    typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : null,
                };
              }
              case 'auth.password-too-short':
                return { kind: 'password-too-short' };
              case 'auth.password-compromised':
                return { kind: 'password-compromised' };
              case 'auth.account-locked':
                return { kind: 'locked' };
              default:
                return FAILED;
            }
          },

          async startSetup(): Promise<SetupStartOutcome> {
            const settled: Settled<AuthenticatorSetup> = await perform(
              'setup',
              null,
              (userId: string): Promise<AuthenticatorSetup> => api.startAuthenticatorSetup(userId),
              null,
            );
            return settled.ok ? { kind: 'started', setup: settled.value } : settled.end;
          },

          async confirmSetup(code: string): Promise<SetupConfirmOutcome> {
            const before: TwoStepOverview | null = shown()?.twoStep ?? null;
            const settled: Settled<AuthenticatorConfirmation> = await perform(
              'confirm',
              null,
              (userId: string): Promise<AuthenticatorConfirmation> =>
                api.confirmAuthenticatorSetup(userId, code),
              (fresh: SecurityOverview): boolean =>
                fresh.twoStep.enabled &&
                (before?.enabled !== true ||
                  isLater(fresh.twoStep.appConfiguredAt, before.appConfiguredAt)),
            );
            if (settled.ok) {
              const confirmation: AuthenticatorConfirmation = settled.value;
              apply((overview: SecurityOverview): SecurityOverview => ({
                ...overview,
                twoStep: confirmation.twoStep,
              }));
              return { kind: 'confirmed', backupCodes: confirmation.backupCodes };
            }
            if (settled.end.kind !== 'failed') return settled.end;
            if (settled.uncertain) {
              if (!settled.applied) return UNCONFIRMED;
              return before?.enabled === true
                ? { kind: 'confirmed', backupCodes: null }
                : { kind: 'enabled-without-codes' };
            }
            switch (codeOf(settled.error)) {
              case 'auth.two-step-code-invalid':
                return { kind: 'code-invalid' };
              case 'auth.two-step-setup-expired':
                return { kind: 'expired' };
              default:
                return FAILED;
            }
          },

          async disable(): Promise<DisableOutcome> {
            const settled: Settled<void> = await perform(
              'disable',
              null,
              (userId: string): Promise<void> => api.disableTwoStep(userId),
              (fresh: SecurityOverview): boolean => !fresh.twoStep.enabled,
            );
            if (settled.ok) {
              apply((overview: SecurityOverview): SecurityOverview => ({
                ...overview,
                twoStep: withTwoStepOff(overview.twoStep),
              }));
              return { kind: 'disabled' };
            }
            if (settled.end.kind !== 'failed') return settled.end;
            if (settled.uncertain) return settled.applied ? { kind: 'disabled' } : UNCONFIRMED;
            return codeOf(settled.error) === 'auth.mfa-required-by-organization'
              ? { kind: 'required' }
              : FAILED;
          },

          async regenerateBackupCodes(): Promise<BackupCodesOutcome> {
            const before: TwoStepOverview | null = shown()?.twoStep ?? null;
            const replaced: number = before?.backupCodes?.remaining ?? 0;
            const settled: Settled<BackupCodeSet> = await perform(
              'backup-codes',
              null,
              (userId: string): Promise<BackupCodeSet> => api.regenerateBackupCodes(userId),
              (fresh: SecurityOverview): boolean =>
                isLater(fresh.twoStep.backupCodes?.generatedAt, before?.backupCodes?.generatedAt),
            );
            if (settled.ok) {
              const codes: BackupCodeSet = settled.value;
              apply((overview: SecurityOverview): SecurityOverview => ({
                ...overview,
                twoStep: withNewBackupCodes(overview.twoStep, codes),
              }));
              return { kind: 'generated', codes, replaced };
            }
            if (settled.end.kind !== 'failed') return settled.end;
            if (settled.uncertain) {
              return settled.applied ? { kind: 'codes-unseen' } : UNCONFIRMED;
            }
            return codeOf(settled.error) === 'auth.two-step-not-enabled'
              ? { kind: 'not-enabled' }
              : FAILED;
          },

          async addSecurityKey(name: string): Promise<SecurityKeyAddOutcome> {
            if (!store.keysSupported) return SKIPPED;
            const dismissed: Error = new Error('The key prompt was dismissed.');
            const known: ReadonlySet<string> = new Set<string>(
              (shown()?.twoStep.securityKeys ?? []).map((key: SecurityKey): string => key.id),
            );
            const settled: Settled<SecurityKey> = await perform(
              'add-key',
              null,
              async (userId: string, step: () => void): Promise<SecurityKey> => {
                let options: PublicKeyCredentialCreationOptionsJSON;
                try {
                  options = await api.startSecurityKeyRegistration(userId);
                } catch (error: unknown) {
                  // No key can exist before the browser answered: a lost answer here is a
                  // plain failure, not one to settle by reading again.
                  throw isUncertain(error)
                    ? new Error('The key registration did not start.', { cause: error })
                    : error;
                }
                step();
                let credential: RegistrationResponseJSON;
                try {
                  credential = await keys.create(options);
                } catch (error: unknown) {
                  if (isPromptDismissed(error)) throw dismissed;
                  throw error;
                }
                step();
                return api.addSecurityKey(userId, name, credential);
              },
              (fresh: SecurityOverview): boolean =>
                fresh.twoStep.securityKeys.some((key: SecurityKey): boolean => !known.has(key.id)),
            );
            if (settled.ok) {
              const key: SecurityKey = settled.value;
              apply((overview: SecurityOverview): SecurityOverview => ({
                ...overview,
                twoStep: {
                  ...overview.twoStep,
                  securityKeys: [
                    ...overview.twoStep.securityKeys.filter(
                      (item: SecurityKey): boolean => item.id !== key.id,
                    ),
                    key,
                  ],
                },
              }));
              return { kind: 'added' };
            }
            if (settled.error === dismissed) return CANCELLED;
            if (settled.end.kind !== 'failed') return settled.end;
            if (settled.uncertain) return settled.applied ? { kind: 'added' } : UNCONFIRMED;
            switch (codeOf(settled.error)) {
              case 'auth.security-key-refused':
                return { kind: 'refused' };
              case 'auth.two-step-setup-expired':
                return { kind: 'expired' };
              case 'auth.security-key-limit-reached':
                return { kind: 'limit-reached' };
              case 'auth.two-step-not-enabled':
                return { kind: 'not-enabled' };
              default:
                return FAILED;
            }
          },

          async removeSecurityKey(key: SecurityKey): Promise<RemovalOutcome> {
            const settled: Settled<void> = await perform(
              'remove-key',
              key.id,
              (userId: string): Promise<void> => api.removeSecurityKey(userId, key.id),
              (fresh: SecurityOverview): boolean =>
                !fresh.twoStep.securityKeys.some(
                  (item: SecurityKey): boolean => item.id === key.id,
                ),
            );
            if (!settled.ok) {
              if (settled.end.kind !== 'failed') return settled.end;
              if (settled.uncertain) return settled.applied ? { kind: 'done' } : UNCONFIRMED;
              if (codeOf(settled.error) !== 'security-key.not-found') return FAILED;
            }
            apply((overview: SecurityOverview): SecurityOverview => ({
              ...overview,
              twoStep: {
                ...overview.twoStep,
                securityKeys: overview.twoStep.securityKeys.filter(
                  (item: SecurityKey): boolean => item.id !== key.id,
                ),
              },
            }));
            return { kind: 'done' };
          },

          async revokeSession(session: AccountSession): Promise<RemovalOutcome> {
            if (session.current) return SKIPPED;
            const settled: Settled<void> = await perform(
              'revoke',
              session.id,
              (userId: string): Promise<void> => api.revokeSession(userId, session.id),
              (fresh: SecurityOverview): boolean =>
                !fresh.sessions.some((item: AccountSession): boolean => item.id === session.id),
            );
            if (!settled.ok) {
              if (settled.end.kind !== 'failed') return settled.end;
              if (settled.uncertain) return settled.applied ? { kind: 'done' } : UNCONFIRMED;
              if (codeOf(settled.error) !== 'session.not-found') return FAILED;
            }
            apply((overview: SecurityOverview): SecurityOverview => ({
              ...overview,
              sessions: overview.sessions.filter(
                (item: AccountSession): boolean => item.id !== session.id,
              ),
            }));
            return { kind: 'done' };
          },

          async revokeOtherSessions(): Promise<RevokeOthersOutcome> {
            const others: number = (shown()?.sessions ?? []).filter(
              (item: AccountSession): boolean => !item.current,
            ).length;
            const settled: Settled<number> = await perform(
              'revoke-others',
              null,
              (userId: string): Promise<number> => api.revokeOtherSessions(userId),
              (fresh: SecurityOverview): boolean =>
                fresh.sessions.every((item: AccountSession): boolean => item.current),
            );
            if (!settled.ok) {
              if (settled.end.kind !== 'failed') return settled.end;
              if (!settled.uncertain) return FAILED;
              return settled.applied ? { kind: 'done', count: others } : UNCONFIRMED;
            }
            apply((overview: SecurityOverview): SecurityOverview => ({
              ...overview,
              sessions: overview.sessions.filter((item: AccountSession): boolean => item.current),
            }));
            return { kind: 'done', count: settled.value };
          },
        };
      },
    ),
  );
}

/**
 * Constant SecurityStore
 *
 * @description
 * The `Security and sign-in` section's store, provided by its page. Its read is the page's
 * primary read, keyed by the workspace's account. Its writes run one at a time through the
 * reauthentication the gateway may ask for, each bound to the account shown when it starts and
 * to the page: once either changes it sends nothing more, drops its answer and ends `cancelled`.
 * A write on its way may still be applied, so `sending` tells it apart from one waiting only for
 * the reauthentication dialog, and `sent()` waits for it until its result is settled. A confirmed
 * write applies its answer to the read. A write whose answer was lost (no status, `408`, `5xx`)
 * may have been applied, or may still be: the section is read again outside the error boundary
 * at once, then 2, 4 and 8 seconds later (`SECURITY_REREAD_DELAYS`), until a read shows the
 * write; each read that answers replaces the one shown. The outcome is then the write's own, or
 * `unconfirmed` when no read showed it, never a failure; nothing is sent again. Passwords, codes and secrets pass through the methods only: those a write brings are
 * returned to the page, never kept in the state.
 *
 * @type {ReturnType<typeof createSecurityStore>}
 */
export const SecurityStore: ReturnType<typeof createSecurityStore> = createSecurityStore();
