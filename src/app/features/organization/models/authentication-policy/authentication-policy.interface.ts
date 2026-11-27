/**
 * Type TwoStepRequirement
 *
 * @description
 * Who must have two-step verification: nobody, the owner and the administrators, or every member
 * (guests included, which implies the administrators).
 *
 * @type {'nobody' | 'admins' | 'everyone'}
 */
export type TwoStepRequirement = 'nobody' | 'admins' | 'everyone';

/**
 * Type SessionTimeout
 *
 * @description
 * Inactivity after which a session acting on the organization closes, in minutes: 1 hour,
 * 12 hours, 7 days or 30 days.
 *
 * @type {60 | 720 | 10080 | 43200}
 */
export type SessionTimeout = 60 | 720 | 10080 | 43200;

/**
 * Interface SessionTimeoutOption
 *
 * @description
 * One option of the `Idle session timeout` select.
 */
export interface SessionTimeoutOption {
  // #region Properties
  /**
   * Property minutes
   *
   * @description
   * The timeout the option selects.
   *
   * @type {SessionTimeout}
   * @readonly
   */
  readonly minutes: SessionTimeout;

  /**
   * Property label
   *
   * @description
   * What the option reads (`12 hours`), also used in the saved toast.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Interface AuthenticationPolicySettings
 *
 * @description
 * The part of the authentication policy the `Authentication policy` card edits. A value a later
 * contract adds, which this version does not know, is null: no switch and no option shows it, and
 * a save leaves it unchanged unless the person changes that control.
 */
export interface AuthenticationPolicySettings {
  // #region Properties
  /**
   * Property twoStepRequiredFor
   *
   * @description
   * Who must have two-step verification, or null for a value this version does not know.
   *
   * @type {TwoStepRequirement | null}
   * @readonly
   */
  readonly twoStepRequiredFor: TwoStepRequirement | null;

  /**
   * Property sessionTimeoutMinutes
   *
   * @description
   * Inactivity before a session closes, or null for a value this version does not know.
   *
   * @type {SessionTimeout | null}
   * @readonly
   */
  readonly sessionTimeoutMinutes: SessionTimeout | null;
  // #endregion
}

/**
 * Interface AuthenticationPolicyForm
 *
 * @description
 * The value of the `Authentication policy` form. The two switches keep their own choice:
 * `requireAdmins` stays what the person chose while `requireEveryone` is on, which shows the
 * administrators' switch on and disabled, so turning `everyone` off goes back to that choice. The
 * sent requirement is `everyone`, else `admins`, else `nobody`.
 */
export interface AuthenticationPolicyForm {
  // #region Properties
  /**
   * Property requireAdmins
   *
   * @description
   * The administrators' switch as the person set it; on for a saved `admins` or `everyone`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly requireAdmins: boolean;

  /**
   * Property requireEveryone
   *
   * @description
   * The all-members switch; on for a saved `everyone`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly requireEveryone: boolean;

  /**
   * Property sessionTimeoutMinutes
   *
   * @description
   * The selected timeout, or null for a value this version does not know.
   *
   * @type {SessionTimeout | null}
   * @readonly
   */
  readonly sessionTimeoutMinutes: SessionTimeout | null;
  // #endregion
}

/**
 * Interface AuthenticationPolicy
 *
 * @description
 * The organization's authentication policy as the security section shows it.
 */
export interface AuthenticationPolicy extends AuthenticationPolicySettings {
  // #region Properties
  /**
   * Property membersWithoutTwoStep
   *
   * @description
   * How many people have no two-step verification: the owner and administrators among them, and
   * all of them, guests included.
   *
   * @type {{ readonly admins: number; readonly everyone: number }}
   * @readonly
   */
  readonly membersWithoutTwoStep: { readonly admins: number; readonly everyone: number };

  /**
   * Property version
   *
   * @description
   * Version of the policy, sent back as `If-Match` with a change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface AuthenticationPolicyChange
 *
 * @description
 * What a save changes; a member left out stays as it is.
 */
export interface AuthenticationPolicyChange {
  // #region Properties
  /**
   * Property twoStepRequiredFor
   *
   * @description
   * The new two-step requirement.
   *
   * @type {TwoStepRequirement | undefined}
   * @readonly
   */
  readonly twoStepRequiredFor?: TwoStepRequirement;

  /**
   * Property sessionTimeoutMinutes
   *
   * @description
   * The new inactivity timeout.
   *
   * @type {SessionTimeout | undefined}
   * @readonly
   */
  readonly sessionTimeoutMinutes?: SessionTimeout;
  // #endregion
}

/**
 * Type AuthenticationPolicySaveOutcome
 *
 * @description
 * How a save ended: `saved`; `skipped` when nothing was sent (no change, nothing loaded, a save
 * already running); `cancelled` when the person closed the reauthentication dialog, or when the
 * organization changed or the page went away before the save could end; `context-changed` when
 * the gateway refused it for a changed organization context (`412 organization.context-changed`,
 * or a switch in progress), which the workspace recovery takes over; `outdated` when the policy
 * changed in the meantime (`412 request.version-mismatch`, the latest version is read again);
 * `two-step-not-enabled` when the person would require two-step verification of their own role
 * without having it (`409`); `failed` for any other refusal.
 *
 * @type {'saved' | 'skipped' | 'cancelled' | 'context-changed' | 'outdated' | 'two-step-not-enabled' | 'failed'}
 */
export type AuthenticationPolicySaveOutcome =
  | 'saved'
  | 'skipped'
  | 'cancelled'
  | 'context-changed'
  | 'outdated'
  | 'two-step-not-enabled'
  | 'failed';
