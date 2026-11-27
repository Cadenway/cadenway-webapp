/**
 * Type AccountLanguage
 *
 * @description
 * A language the account can choose (`ProfilePatch.language` of `auth.yaml`): French, English,
 * German or Spanish.
 *
 * @type {'fr' | 'en' | 'de' | 'es'}
 */
export type AccountLanguage = 'fr' | 'en' | 'de' | 'es';

/**
 * Interface AccountLanguageSettings
 *
 * @description
 * The account's language as the preferences section shows it, with the account version its
 * changes are sent against.
 */
export interface AccountLanguageSettings {
  // #region Properties
  /**
   * Property language
   *
   * @description
   * The account's language, or null when the gateway answers a tag the section does not offer.
   *
   * @type {AccountLanguage | null}
   * @readonly
   */
  readonly language: AccountLanguage | null;

  /**
   * Property version
   *
   * @description
   * Version of the account (its `ETag`), sent as `If-Match` with a change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
