import type { AccountSession } from '../session/session.interface';
import type { AuthenticatorSetup, BackupCodeSet, TwoStepOverview } from './two-step.interface';

/**
 * Interface SecurityOverview
 *
 * @description
 * What the `Security and sign-in` section reads at once: the account's address and password
 * date, its two-step verification and its open sessions. It never holds a secret.
 */
export interface SecurityOverview {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The account's address, named by the password toast and the backup codes file.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property passwordChangedAt
   *
   * @description
   * When the password was last set (ISO 8601), or null when the gateway does not say.
   *
   * @type {string | null}
   * @readonly
   */
  readonly passwordChangedAt: string | null;

  /**
   * Property twoStep
   *
   * @description
   * The two-step verification of the account.
   *
   * @type {TwoStepOverview}
   * @readonly
   */
  readonly twoStep: TwoStepOverview;

  /**
   * Property sessions
   *
   * @description
   * The open sessions, the current one first, then the most recently active.
   *
   * @type {readonly AccountSession[]}
   * @readonly
   */
  readonly sessions: readonly AccountSession[];
  // #endregion
}

/**
 * Type SecurityAction
 *
 * @description
 * The write a section's control starts; the store runs one at a time.
 *
 * @type {'password' | 'setup' | 'confirm' | 'disable' | 'backup-codes' | 'add-key' | 'remove-key' | 'revoke' | 'revoke-others'}
 */
export type SecurityAction =
  | 'password'
  | 'setup'
  | 'confirm'
  | 'disable'
  | 'backup-codes'
  | 'add-key'
  | 'remove-key'
  | 'revoke'
  | 'revoke-others';

/**
 * Interface SecurityWriteEnd
 *
 * @description
 * How any write may end without its own result.
 */
export interface SecurityWriteEnd {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * `cancelled` (the reauthentication dialog was closed, the account changed, or the page left;
   * nothing is shown), `failed` (refused or unanswered) or `skipped` (another write was running,
   * or nothing was read yet).
   *
   * @type {'cancelled' | 'failed' | 'skipped'}
   * @readonly
   */
  readonly kind: 'cancelled' | 'failed' | 'skipped';
  // #endregion
}

/**
 * Type PasswordChangeOutcome
 *
 * @description
 * How a password change ended. The refusals of the contract keep the dialog open on the field
 * they concern: `password-incorrect` (with the attempts left when known), `password-too-short`,
 * `password-compromised` and `locked` (too many failures). An answer that was lost (no status,
 * `408`, `5xx`) is settled by reading the account again over 14 seconds: a newer password date is
 * `saved`, otherwise `unconfirmed`. It is never sent again.
 *
 * @type {{ readonly kind: 'saved' } | { readonly kind: 'password-incorrect'; readonly remainingAttempts: number | null } | { readonly kind: 'password-too-short' | 'password-compromised' | 'locked' } | { readonly kind: 'unconfirmed' } | SecurityWriteEnd}
 */
export type PasswordChangeOutcome =
  | { readonly kind: 'saved' }
  | { readonly kind: 'password-incorrect'; readonly remainingAttempts: number | null }
  | { readonly kind: 'password-too-short' | 'password-compromised' | 'locked' }
  | { readonly kind: 'unconfirmed' }
  | SecurityWriteEnd;

/**
 * Type SetupStartOutcome
 *
 * @description
 * How the start of an authenticator app setup ended; `started` carries the key to show once.
 *
 * @type {{ readonly kind: 'started'; readonly setup: AuthenticatorSetup } | SecurityWriteEnd}
 */
export type SetupStartOutcome =
  { readonly kind: 'started'; readonly setup: AuthenticatorSetup } | SecurityWriteEnd;

/**
 * Type SetupConfirmOutcome
 *
 * @description
 * How the confirmation of the app with one of its codes ended: `confirmed` with the first backup
 * codes (null for a reconfiguration), `code-invalid` (the setup stays pending) or `expired` (the
 * person starts again). A lost answer is settled by reading the section again over 14 seconds:
 * two-step verification now on is `enabled-without-codes` (its codes were never shown), a new app
 * date after a reconfiguration is `confirmed` without codes, otherwise `unconfirmed`.
 *
 * @type {{ readonly kind: 'confirmed'; readonly backupCodes: BackupCodeSet | null } | { readonly kind: 'code-invalid' | 'expired' | 'enabled-without-codes' | 'unconfirmed' } | SecurityWriteEnd}
 */
export type SetupConfirmOutcome =
  | { readonly kind: 'confirmed'; readonly backupCodes: BackupCodeSet | null }
  | { readonly kind: 'code-invalid' | 'expired' | 'enabled-without-codes' | 'unconfirmed' }
  | SecurityWriteEnd;

/**
 * Type DisableOutcome
 *
 * @description
 * How turning two-step verification off ended; `required` when an organization's policy still
 * requires it. A lost answer is settled by reading the section again over 14 seconds: off is
 * `disabled`, otherwise `unconfirmed`.
 *
 * @type {{ readonly kind: 'disabled' | 'required' | 'unconfirmed' } | SecurityWriteEnd}
 */
export type DisableOutcome =
  { readonly kind: 'disabled' | 'required' | 'unconfirmed' } | SecurityWriteEnd;

/**
 * Type BackupCodesOutcome
 *
 * @description
 * How the generation of new backup codes ended: `generated` with the codes to show once and how
 * many unused codes they replaced, or `not-enabled` when two-step verification is off. A lost
 * answer is settled by reading the section again over 14 seconds: a newer generation date is
 * `codes-unseen` (the previous codes stopped working and the new ones were never shown),
 * otherwise `unconfirmed` (the codes may have changed).
 *
 * @type {{ readonly kind: 'generated'; readonly codes: BackupCodeSet; readonly replaced: number } | { readonly kind: 'not-enabled' | 'codes-unseen' | 'unconfirmed' } | SecurityWriteEnd}
 */
export type BackupCodesOutcome =
  | { readonly kind: 'generated'; readonly codes: BackupCodeSet; readonly replaced: number }
  | { readonly kind: 'not-enabled' | 'codes-unseen' | 'unconfirmed' }
  | SecurityWriteEnd;

/**
 * Type SecurityKeyAddOutcome
 *
 * @description
 * How the registration of a security key ended: `added`, `refused` (the browser's answer did not
 * verify, or the key is already registered), `expired` (the registration took more than 5
 * minutes), `limit-reached` (10 keys) or `not-enabled`. The person closing the browser's prompt
 * ends `cancelled`. A lost answer of the registration is settled by reading the section again
 * over 14 seconds: a key not shown before is `added`, otherwise `unconfirmed`.
 *
 * @type {{ readonly kind: 'added' | 'refused' | 'expired' | 'limit-reached' | 'not-enabled' | 'unconfirmed' } | SecurityWriteEnd}
 */
export type SecurityKeyAddOutcome =
  | {
      readonly kind:
        'added' | 'refused' | 'expired' | 'limit-reached' | 'not-enabled' | 'unconfirmed';
    }
  | SecurityWriteEnd;

/**
 * Type RemovalOutcome
 *
 * @description
 * How the removal of a key or the revocation of a session ended; `done` once it is gone. A lost
 * answer is settled by reading the section again over 14 seconds: the target gone is `done`,
 * otherwise `unconfirmed`.
 *
 * @type {{ readonly kind: 'done' | 'unconfirmed' } | SecurityWriteEnd}
 */
export type RemovalOutcome = { readonly kind: 'done' | 'unconfirmed' } | SecurityWriteEnd;

/**
 * Type RevokeOthersOutcome
 *
 * @description
 * How closing the other sessions ended; `done` with how many closed. A lost answer is settled by
 * reading the section again over 14 seconds: no other session left is `done` (with the count
 * shown before), otherwise `unconfirmed`.
 *
 * @type {{ readonly kind: 'done'; readonly count: number } | { readonly kind: 'unconfirmed' } | SecurityWriteEnd}
 */
export type RevokeOthersOutcome =
  | { readonly kind: 'done'; readonly count: number }
  | { readonly kind: 'unconfirmed' }
  | SecurityWriteEnd;
