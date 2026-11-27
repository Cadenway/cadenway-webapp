/**
 * Type ApiTokenScope
 *
 * @description
 * A scope a new token may receive (`openapi/public/api-tokens.yaml`, "Scopes"), in the order the
 * create dialog lists them. A listed token may carry a later scope the contract adds; it is shown
 * as is.
 *
 * @type {'tasks:read' | 'tasks:write' | 'members:read' | 'webhooks:manage'}
 */
export type ApiTokenScope = 'tasks:read' | 'tasks:write' | 'members:read' | 'webhooks:manage';

/**
 * Type ApiTokenExpiration
 *
 * @description
 * How long a new token works, counted from its creation: 30 days (the default), 90 days, a year,
 * or until it is revoked.
 *
 * @type {'30-days' | '90-days' | '1-year' | 'never'}
 */
export type ApiTokenExpiration = '30-days' | '90-days' | '1-year' | 'never';

/**
 * Type ApiTokenLastUse
 *
 * @description
 * When a token last called the API, as the `Last used` column words it: never, a number of
 * minutes (at least 1), hours or days ago, or a date (`date`, `YYYY-MM-DD`) past 60 days.
 *
 * @type {{ readonly kind: 'never' } | { readonly kind: 'minutes' | 'hours' | 'days'; readonly count: number } | { readonly kind: 'date'; readonly date: string }}
 */
export type ApiTokenLastUse =
  | { readonly kind: 'never' }
  | { readonly kind: 'minutes' | 'hours' | 'days'; readonly count: number }
  | { readonly kind: 'date'; readonly date: string };

/**
 * Type ApiTokenExpiry
 *
 * @description
 * When a token stops working, as the `Expires` column words it: never; in a number of days (at
 * least 1) up to 90, the longest day option of the create dialog; in a number of years when it
 * falls on today's calendar date a whole number of years ahead (the `1 year` option); otherwise
 * on a date (`date`, `YYYY-MM-DD`). `soon` marks a token that expires within 7 days, which the
 * column shows in grenat (`Compte.dc.html` lines 815 and 1487).
 *
 * @type {{ readonly kind: 'never'; readonly soon: false } | { readonly kind: 'days'; readonly count: number; readonly soon: boolean } | { readonly kind: 'years'; readonly count: number; readonly soon: false } | { readonly kind: 'date'; readonly date: string; readonly soon: false }}
 */
export type ApiTokenExpiry =
  | { readonly kind: 'never'; readonly soon: false }
  | { readonly kind: 'days'; readonly count: number; readonly soon: boolean }
  | { readonly kind: 'years'; readonly count: number; readonly soon: false }
  | { readonly kind: 'date'; readonly date: string; readonly soon: false };

/**
 * Interface ApiToken
 *
 * @description
 * A personal API token of the signed-in person in the current organization, as the token list
 * shows it. It never carries the secret.
 */
export interface ApiToken {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the token, which revokes it.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name the person gave it.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property prefix
   *
   * @description
   * The first 11 characters of the secret followed by an ellipsis (`cw_pat_4c1e…`), to recognize
   * the token.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes of the token, as the gateway lists them.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly scopes: readonly string[];

  /**
   * Property lastUse
   *
   * @description
   * When it last called the API.
   *
   * @type {ApiTokenLastUse}
   * @readonly
   */
  readonly lastUse: ApiTokenLastUse;

  /**
   * Property expiry
   *
   * @description
   * When it stops working.
   *
   * @type {ApiTokenExpiry}
   * @readonly
   */
  readonly expiry: ApiTokenExpiry;
  // #endregion
}

/**
 * Interface ApiTokenDraft
 *
 * @description
 * What the create dialog submits.
 */
export interface ApiTokenDraft {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name of the token, trimmed, 1 to 100 characters.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes granted, at least one.
   *
   * @type {readonly ApiTokenScope[]}
   * @readonly
   */
  readonly scopes: readonly ApiTokenScope[];

  /**
   * Property expiration
   *
   * @description
   * How long the token works.
   *
   * @type {ApiTokenExpiration}
   * @readonly
   */
  readonly expiration: ApiTokenExpiration;
  // #endregion
}

/**
 * Interface CreatedApiToken
 *
 * @description
 * A token just created and its secret, which the gateway returns this once only. The secret is
 * never logged nor persisted.
 */
export interface CreatedApiToken {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The new token, as the list shows it.
   *
   * @type {ApiToken}
   * @readonly
   */
  readonly token: ApiToken;

  /**
   * Property secret
   *
   * @description
   * The token itself (`cw_pat_…`), shown once in the create dialog.
   *
   * @type {string}
   * @readonly
   */
  readonly secret: string;
  // #endregion
}
