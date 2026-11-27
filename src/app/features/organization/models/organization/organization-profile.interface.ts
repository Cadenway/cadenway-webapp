/**
 * Type OrganizationLanguage
 *
 * @description
 * A default language of the organization this version knows: French, English or German
 * (`defaultLanguage` is an extensible enum).
 *
 * @type {'fr' | 'en' | 'de'}
 */
export type OrganizationLanguage = 'fr' | 'en' | 'de';

/**
 * Type OrganizationField
 *
 * @description
 * A field of the `Identity` form.
 *
 * @type {'name' | 'slug' | 'description' | 'website' | 'defaultLanguage'}
 */
export type OrganizationField = 'name' | 'slug' | 'description' | 'website' | 'defaultLanguage';

/**
 * Interface OrganizationProfile
 *
 * @description
 * The current organization as the `Organization profile` section shows it.
 */
export interface OrganizationProfile {
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
   * Property slug
   *
   * @description
   * Address of the organization, the first segment of its pages (`atelier-nord`).
   *
   * @type {string}
   * @readonly
   */
  readonly slug: string;

  /**
   * Property description
   *
   * @description
   * Description shown on the invitation page, or null when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property website
   *
   * @description
   * Absolute `https` or `http` address, or null when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly website: string | null;

  /**
   * Property defaultLanguage
   *
   * @description
   * Default language, or null for a language this version does not know.
   *
   * @type {OrganizationLanguage | null}
   * @readonly
   */
  readonly defaultLanguage: OrganizationLanguage | null;

  /**
   * Property logoId
   *
   * @description
   * Reference of the current logo, or null without a logo.
   *
   * @type {string | null}
   * @readonly
   */
  readonly logoId: string | null;

  /**
   * Property initials
   *
   * @description
   * Initials of the name, shown in place of a logo (`AN`).
   *
   * @type {string}
   * @readonly
   */
  readonly initials: string;

  /**
   * Property version
   *
   * @description
   * Version of the organization, sent back as `If-Match` with a change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface OrganizationProfileForm
 *
 * @description
 * The value of the `Identity` form. An empty description or website clears it; a null language
 * is one this version does not know, left unchanged until another option is picked.
 */
export interface OrganizationProfileForm {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property slug
   *
   * @description
   * Address as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly slug: string;

  /**
   * Property description
   *
   * @description
   * Description as typed; empty for none.
   *
   * @type {string}
   * @readonly
   */
  readonly description: string;

  /**
   * Property website
   *
   * @description
   * Website as typed; empty for none.
   *
   * @type {string}
   * @readonly
   */
  readonly website: string;

  /**
   * Property defaultLanguage
   *
   * @description
   * The selected language, or null while the saved one is unknown to this version.
   *
   * @type {OrganizationLanguage | null}
   * @readonly
   */
  readonly defaultLanguage: OrganizationLanguage | null;
  // #endregion
}

/**
 * Interface OrganizationProfileChange
 *
 * @description
 * What a save changes; a member left out stays as it is, and a null description or website clears
 * it.
 */
export interface OrganizationProfileChange {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * The new name.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly name?: string;

  /**
   * Property slug
   *
   * @description
   * The new address.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly slug?: string;

  /**
   * Property description
   *
   * @description
   * The new description, or null to clear it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly description?: string | null;

  /**
   * Property website
   *
   * @description
   * The new website, or null to clear it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly website?: string | null;

  /**
   * Property defaultLanguage
   *
   * @description
   * The new default language.
   *
   * @type {OrganizationLanguage | undefined}
   * @readonly
   */
  readonly defaultLanguage?: OrganizationLanguage;
  // #endregion
}

/**
 * Interface OrganizationLanguageOption
 *
 * @description
 * One option of the `Default language` select.
 */
export interface OrganizationLanguageOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The language the option selects.
   *
   * @type {OrganizationLanguage}
   * @readonly
   */
  readonly value: OrganizationLanguage;

  /**
   * Property label
   *
   * @description
   * The language's own name (`Français`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property flag
   *
   * @description
   * The flag icon shown before the name (`flagFr`).
   *
   * @type {string}
   * @readonly
   */
  readonly flag: string;
  // #endregion
}

/**
 * Interface OrganizationLogoUpload
 *
 * @description
 * A reserved logo upload: the signed form destination the image is sent to, then published.
 */
export interface OrganizationLogoUpload {
  // #region Properties
  /**
   * Property uploadId
   *
   * @description
   * Identifier of the reservation, published once the image is sent.
   *
   * @type {string}
   * @readonly
   */
  readonly uploadId: string;

  /**
   * Property url
   *
   * @description
   * Signed multipart destination of the image.
   *
   * @type {string}
   * @readonly
   */
  readonly url: string;

  /**
   * Property fields
   *
   * @description
   * Signed form fields, sent unchanged before the image.
   *
   * @type {Readonly<Record<string, string>>}
   * @readonly
   */
  readonly fields: Readonly<Record<string, string>>;
  // #endregion
}

/**
 * Interface OrganizationFieldRefusal
 *
 * @description
 * Why the gateway refused a field: the address is used by another organization (`409
 * organization.slug-taken`), kept for a page of the application (`422 organization.slug-reserved`),
 * or the value does not match the contract (`400 request.invalid` with an issue on the field).
 */
export interface OrganizationFieldRefusal {
  // #region Properties
  /**
   * Property field
   *
   * @description
   * The refused field.
   *
   * @type {OrganizationField}
   * @readonly
   */
  readonly field: OrganizationField;

  /**
   * Property reason
   *
   * @description
   * Why it was refused.
   *
   * @type {'slug-taken' | 'slug-reserved' | 'invalid'}
   * @readonly
   */
  readonly reason: 'slug-taken' | 'slug-reserved' | 'invalid';
  // #endregion
}

/**
 * Type OrganizationSaveResult
 *
 * @description
 * How a save ended: `saved`; `refused` with the refused fields;
 * `skipped` when nothing was sent (no change, nothing loaded, a save or a logo change already
 * running); `cancelled` when the organization changed or the page went away before the save could
 * end; `context-changed` when the gateway refused it for a changed organization context (`412
 * organization.context-changed`, or a switch in progress), which the workspace recovery takes over;
 * `outdated` when the organization changed in the meantime (`412 request.version-mismatch`, the
 * latest version has been read again); `unreconciled` when the gateway may have applied it but
 * the organization could not be read again to show it; `failed` for any other refusal.
 *
 * @type {{ readonly outcome: 'refused'; readonly refusals: readonly OrganizationFieldRefusal[] } | { readonly outcome: 'saved' | 'skipped' | 'cancelled' | 'context-changed' | 'outdated' | 'unreconciled' | 'failed' }}
 */
export type OrganizationSaveResult =
  | { readonly outcome: 'refused'; readonly refusals: readonly OrganizationFieldRefusal[] }
  | {
      readonly outcome:
        | 'saved'
        | 'skipped'
        | 'cancelled'
        | 'context-changed'
        | 'outdated'
        | 'unreconciled'
        | 'failed';
    };

/**
 * Type OrganizationLogoOutcome
 *
 * @description
 * How a logo change ended: `updated` or `removed`; `unsupported` for a file that is neither PNG
 * nor SVG; `too-large` for a file over 5 MiB; `unreadable` for an empty file; `invalid-image` for
 * an image storage refuses (not square, too large, not still or not safe); `skipped`,
 * `cancelled`, `context-changed`, `outdated`, `unreconciled` (applied, or stale, but the
 * organization could not be read again) and `failed` as for a save.
 *
 * @type {'updated' | 'removed' | 'unsupported' | 'too-large' | 'unreadable' | 'invalid-image' | 'skipped' | 'cancelled' | 'context-changed' | 'outdated' | 'unreconciled' | 'failed'}
 */
export type OrganizationLogoOutcome =
  | 'updated'
  | 'removed'
  | 'unsupported'
  | 'too-large'
  | 'unreadable'
  | 'invalid-image'
  | 'skipped'
  | 'cancelled'
  | 'context-changed'
  | 'outdated'
  | 'unreconciled'
  | 'failed';
