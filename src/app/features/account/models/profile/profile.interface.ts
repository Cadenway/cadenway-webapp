/**
 * Type ProfileField
 *
 * @description
 * A field of the `Personal information` form.
 *
 * @type {'name' | 'displayName' | 'jobTitle' | 'timeZone'}
 */
export type ProfileField = 'name' | 'displayName' | 'jobTitle' | 'timeZone';

/**
 * Interface AccountProfile
 *
 * @description
 * The signed-in account as the `Profile` section shows it.
 */
export interface AccountProfile {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Full name (`Camille Martin`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property displayName
   *
   * @description
   * Name used for the mentions (`camille`), or null until the person chooses one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly displayName: string | null;

  /**
   * Property jobTitle
   *
   * @description
   * Job title, or null when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly jobTitle: string | null;

  /**
   * Property email
   *
   * @description
   * Address of the account, the one it signs in with.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property timeZone
   *
   * @description
   * IANA time zone name (`Europe/Paris`).
   *
   * @type {string}
   * @readonly
   */
  readonly timeZone: string;

  /**
   * Property avatarId
   *
   * @description
   * Reference of the current photo, or null without one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly avatarId: string | null;

  /**
   * Property initials
   *
   * @description
   * Initials of the name, shown in place of a photo (`CM`).
   *
   * @type {string}
   * @readonly
   */
  readonly initials: string;

  /**
   * Property version
   *
   * @description
   * Version of the account, sent as `If-Match` by the writes made from it.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface ProfileForm
 *
 * @description
 * The value of the `Personal information` form, as typed.
 */
export interface ProfileForm {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * `Full name`.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property displayName
   *
   * @description
   * `Display name`, empty for none.
   *
   * @type {string}
   * @readonly
   */
  readonly displayName: string;

  /**
   * Property jobTitle
   *
   * @description
   * `Job title (optional)`, empty for none.
   *
   * @type {string}
   * @readonly
   */
  readonly jobTitle: string;

  /**
   * Property timeZone
   *
   * @description
   * `Time zone`, or null while none is chosen.
   *
   * @type {string | null}
   * @readonly
   */
  readonly timeZone: string | null;
  // #endregion
}

/**
 * Interface ProfileChange
 *
 * @description
 * What a save changes: a member left out is unchanged, a null display name or job title clears
 * it.
 */
export interface ProfileChange {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * The new full name, trimmed.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly name?: string;

  /**
   * Property displayName
   *
   * @description
   * The new display name, trimmed, or null to clear it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly displayName?: string | null;

  /**
   * Property jobTitle
   *
   * @description
   * The new job title, trimmed, or null to clear it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly jobTitle?: string | null;

  /**
   * Property timeZone
   *
   * @description
   * The new IANA time zone name.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly timeZone?: string;
  // #endregion
}

/**
 * Interface ProfileFieldRefusal
 *
 * @description
 * A field the gateway refused with `400 request.invalid`.
 */
export interface ProfileFieldRefusal {
  // #region Properties
  /**
   * Property field
   *
   * @description
   * The refused field.
   *
   * @type {ProfileField}
   * @readonly
   */
  readonly field: ProfileField;
  // #endregion
}

/**
 * Type ProfileSaveResult
 *
 * @description
 * How a save ended:
 * - `saved`: the account holds the change;
 * - `refused`: the gateway refused fields of the form, listed in `refusals`;
 * - `outdated`: the account changed meanwhile and was read again;
 * - `unreconciled`: the reread that should have told the outcome failed;
 * - `unconfirmed`: the answer was lost and the account read again until 8 s later still does not
 *   hold the change, which may yet land: the draft stays unsaved;
 * - `failed`: any other refusal;
 * - `skipped`: nothing was sent (nothing changed, nothing read, or another write runs);
 * - `cancelled`: the account or the page changed meanwhile, so the answer is dropped.
 *
 * @type {{ readonly outcome: 'saved' | 'outdated' | 'unreconciled' | 'unconfirmed' | 'failed' | 'skipped' | 'cancelled' } | { readonly outcome: 'refused'; readonly refusals: readonly ProfileFieldRefusal[] }}
 */
export type ProfileSaveResult =
  | {
      readonly outcome:
        'saved' | 'outdated' | 'unreconciled' | 'unconfirmed' | 'failed' | 'skipped' | 'cancelled';
    }
  | { readonly outcome: 'refused'; readonly refusals: readonly ProfileFieldRefusal[] };

/**
 * Type AvatarOutcome
 *
 * @description
 * How a photo change ended: `updated` or `removed` once the account is read again; `unsupported`,
 * `unreadable`, `too-large` and `invalid-image` for a refused file; `outdated` after a stale
 * version (the account is read again); `unreconciled` when that reread failed; `unconfirmed` when
 * the answer of the publication or the removal was lost and the account read again until 8 s
 * later shows the same photo; `failed` for any other refusal; `skipped` when nothing was sent;
 * `cancelled` when the account or the page changed meanwhile.
 *
 * @type {'updated' | 'removed' | 'unsupported' | 'unreadable' | 'too-large' | 'invalid-image' | 'outdated' | 'unreconciled' | 'unconfirmed' | 'failed' | 'skipped' | 'cancelled'}
 */
export type AvatarOutcome =
  | 'updated'
  | 'removed'
  | 'unsupported'
  | 'unreadable'
  | 'too-large'
  | 'invalid-image'
  | 'outdated'
  | 'unreconciled'
  | 'unconfirmed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

/**
 * Interface AvatarUpload
 *
 * @description
 * A reserved photo upload: the signed destination the image is sent to.
 */
export interface AvatarUpload {
  // #region Properties
  /**
   * Property uploadId
   *
   * @description
   * The reservation, published once the image is sent.
   *
   * @type {string}
   * @readonly
   */
  readonly uploadId: string;

  /**
   * Property url
   *
   * @description
   * The signed destination of the multipart POST.
   *
   * @type {string}
   * @readonly
   */
  readonly url: string;

  /**
   * Property fields
   *
   * @description
   * The signed form fields, sent unchanged before the file.
   *
   * @type {Readonly<Record<string, string>>}
   * @readonly
   */
  readonly fields: Readonly<Record<string, string>>;
  // #endregion
}

/**
 * Interface EmailChangeCode
 *
 * @description
 * A code sent to the new address of an e-mail change.
 */
export interface EmailChangeCode {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The new address the code was sent to.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property resendAvailableAt
   *
   * @description
   * When another code can be asked for, in milliseconds since the epoch.
   *
   * @type {number}
   * @readonly
   */
  readonly resendAvailableAt: number;
  // #endregion
}

/**
 * Type EmailRequestResult
 *
 * @description
 * How asking for a code ended: `sent` with the code's details; `refused` with why (`invalid`,
 * `unchanged`, `taken` or `throttled`, the last with when to ask again when known); `failed` for
 * any other failure; `cancelled` when the reauthentication was closed, or the account or the page
 * changed meanwhile.
 *
 * @type {{ readonly outcome: 'sent'; readonly code: EmailChangeCode } | { readonly outcome: 'refused'; readonly reason: 'invalid' | 'unchanged' | 'taken' | 'throttled'; readonly resendAvailableAt: number | null } | { readonly outcome: 'failed' | 'cancelled' }}
 */
export type EmailRequestResult =
  | { readonly outcome: 'sent'; readonly code: EmailChangeCode }
  | {
      readonly outcome: 'refused';
      readonly reason: 'invalid' | 'unchanged' | 'taken' | 'throttled';
      readonly resendAvailableAt: number | null;
    }
  | { readonly outcome: 'failed' | 'cancelled' };

/**
 * Type EmailConfirmOutcome
 *
 * @description
 * How confirming the code ended: `confirmed` once the account holds the new address;
 * `wrong-code` for a wrong, expired or used code; `taken` when another account took the address
 * meanwhile (the change is dropped); `unconfirmed` when the answer was lost and the account read
 * again until 8 s later still has its former address; `failed` for any other failure; `cancelled`
 * when the account or the page changed meanwhile.
 *
 * @type {'confirmed' | 'wrong-code' | 'taken' | 'unconfirmed' | 'failed' | 'cancelled'}
 */
export type EmailConfirmOutcome =
  'confirmed' | 'wrong-code' | 'taken' | 'unconfirmed' | 'failed' | 'cancelled';

/**
 * Interface MyOrganization
 *
 * @description
 * An organization of the person, as the account deletion names it.
 */
export interface MyOrganization {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the organization.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the organization (`Atelier Nord`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property owned
   *
   * @description
   * Whether the person owns it, so it must first have another owner.
   *
   * @type {boolean}
   * @readonly
   */
  readonly owned: boolean;
  // #endregion
}

/**
 * Type DeletionResult
 *
 * @description
 * How scheduling the deletion ended: `scheduled` once the gateway answered so, after which the
 * session is gone; `owner` when the person still owns organizations, listed by id;
 * `unconfirmed` when the answer was lost and the account could no longer be read (the session may
 * have been revoked by the deletion, or have ended for another reason, which the contract does not
 * tell apart); `failed` for any other failure, the account still read after the rereads included;
 * `cancelled` when the reauthentication was closed, or the account or the page changed meanwhile.
 *
 * @type {{ readonly outcome: 'scheduled' | 'unconfirmed' | 'failed' | 'cancelled' } | { readonly outcome: 'owner'; readonly organizationIds: readonly string[] }}
 */
export type DeletionResult =
  | { readonly outcome: 'scheduled' | 'unconfirmed' | 'failed' | 'cancelled' }
  | { readonly outcome: 'owner'; readonly organizationIds: readonly string[] };

/**
 * Interface TimeZoneOption
 *
 * @description
 * An option of the `Time zone` combobox.
 */
export interface TimeZoneOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * IANA time zone name sent (`Europe/Paris`).
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property label
   *
   * @description
   * The name with its current offset (`Europe/Paris (UTC+1)`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}
