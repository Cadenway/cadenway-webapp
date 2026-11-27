/**
 * Type TwoStepRequirementScope
 *
 * @description
 * Who an organization's policy requires two-step verification of: `admins` (the owner and the
 * administrators) or `everyone` (every member). `unknown` stands for a value a later contract
 * adds (`requiredFor` is an extensible enum), which the card words without a role.
 *
 * @type {'admins' | 'everyone' | 'unknown'}
 */
export type TwoStepRequirementScope = 'admins' | 'everyone' | 'unknown';

/**
 * Interface TwoStepRequirement
 *
 * @description
 * An organization whose authentication policy requires two-step verification of the person.
 */
export interface TwoStepRequirement {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Id of the organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property requiredFor
   *
   * @description
   * Who the policy requires it of.
   *
   * @type {TwoStepRequirementScope}
   * @readonly
   */
  readonly requiredFor: TwoStepRequirementScope;
  // #endregion
}

/**
 * Interface SecurityKey
 *
 * @description
 * A security key or the biometrics of a device registered on the account.
 */
export interface SecurityKey {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the key.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * The name the person gave it.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property createdAt
   *
   * @description
   * When it was registered (ISO 8601).
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;

  /**
   * Property lastUsedAt
   *
   * @description
   * When it last answered a challenge (ISO 8601), null before the first.
   *
   * @type {string | null}
   * @readonly
   */
  readonly lastUsedAt: string | null;
  // #endregion
}

/**
 * Interface BackupCodesSummary
 *
 * @description
 * How many backup codes are left, without the codes.
 */
export interface BackupCodesSummary {
  // #region Properties
  /**
   * Property remaining
   *
   * @description
   * Codes not used yet.
   *
   * @type {number}
   * @readonly
   */
  readonly remaining: number;

  /**
   * Property total
   *
   * @description
   * Codes generated together.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Interface TwoStepOverview
 *
 * @description
 * The two-step verification of the account, as the `Two-step verification` card shows it. It
 * never holds a secret.
 */
export interface TwoStepOverview {
  // #region Properties
  /**
   * Property enabled
   *
   * @description
   * Whether two-step verification is on.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;

  /**
   * Property appIsPrimary
   *
   * @description
   * Whether a challenge opens on the authenticator app (`primary method`); false for a primary
   * method this version does not know.
   *
   * @type {boolean}
   * @readonly
   */
  readonly appIsPrimary: boolean;

  /**
   * Property appConfiguredAt
   *
   * @description
   * When the current authenticator app was confirmed (ISO 8601), null while off.
   *
   * @type {string | null}
   * @readonly
   */
  readonly appConfiguredAt: string | null;

  /**
   * Property securityKeys
   *
   * @description
   * The registered keys, the oldest first.
   *
   * @type {readonly SecurityKey[]}
   * @readonly
   */
  readonly securityKeys: readonly SecurityKey[];

  /**
   * Property backupCodes
   *
   * @description
   * The backup codes left, null while off.
   *
   * @type {BackupCodesSummary | null}
   * @readonly
   */
  readonly backupCodes: BackupCodesSummary | null;

  /**
   * Property requiredBy
   *
   * @description
   * The organizations whose policy requires it of the person; while one is listed it cannot be
   * turned off.
   *
   * @type {readonly TwoStepRequirement[]}
   * @readonly
   */
  readonly requiredBy: readonly TwoStepRequirement[];
  // #endregion
}

/**
 * Interface AuthenticatorSetup
 *
 * @description
 * A pending authenticator app setup. `secret` is a secret: it is shown once, never logged, never
 * stored, and forgotten once the setup dialog has left.
 */
export interface AuthenticatorSetup {
  // #region Properties
  /**
   * Property secret
   *
   * @description
   * The TOTP key in base32, without spaces.
   *
   * @type {string}
   * @readonly
   */
  readonly secret: string;
  // #endregion
}

/**
 * Interface BackupCodeSet
 *
 * @description
 * Backup codes just generated, returned once. The codes are secrets: shown, copied or downloaded
 * on request, never logged or stored, and forgotten once their dialog has left.
 */
export interface BackupCodeSet {
  // #region Properties
  /**
   * Property codes
   *
   * @description
   * The 10 codes, `XXXX-XXXX`.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly codes: readonly string[];

  /**
   * Property generatedAt
   *
   * @description
   * When they were generated (ISO 8601).
   *
   * @type {string}
   * @readonly
   */
  readonly generatedAt: string;
  // #endregion
}

/**
 * Interface AuthenticatorConfirmation
 *
 * @description
 * The answer to a confirmed authenticator app: the new two-step state and, when two-step
 * verification just turned on, its backup codes (null for a reconfiguration).
 */
export interface AuthenticatorConfirmation {
  // #region Properties
  /**
   * Property twoStep
   *
   * @description
   * The two-step verification after the confirmation.
   *
   * @type {TwoStepOverview}
   * @readonly
   */
  readonly twoStep: TwoStepOverview;

  /**
   * Property backupCodes
   *
   * @description
   * The first backup codes, or null for a reconfiguration.
   *
   * @type {BackupCodeSet | null}
   * @readonly
   */
  readonly backupCodes: BackupCodeSet | null;
  // #endregion
}
