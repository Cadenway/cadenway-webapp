import {
  APP_LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
} from '../../constants/locale/locale.constants';
import type { AppLocale } from '../../models/locale/locale.type';

/**
 * Interface PageAddress
 *
 * @description
 * The parts of the current address a locale switch keeps.
 */
export interface PageAddress {
  // #region Properties
  /**
   * Property pathname
   *
   * @description
   * The path, the locale segment included (`/fr/atelier-nord/home`).
   *
   * @type {string}
   * @readonly
   */
  readonly pathname: string;

  /**
   * Property search
   *
   * @description
   * The query, its `?` included, or an empty string.
   *
   * @type {string}
   * @readonly
   */
  readonly search: string;

  /**
   * Property hash
   *
   * @description
   * The fragment, its `#` included, or an empty string.
   *
   * @type {string}
   * @readonly
   */
  readonly hash: string;
  // #endregion
}

/**
 * Function isAppLocale
 *
 * @description
 * Tells whether a value names a locale the application is built in.
 *
 * @param {unknown} value - Value to check.
 * @returns {boolean} Whether the value is an `AppLocale`.
 */
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

/**
 * Function localeAddress
 *
 * @description
 * The same page in another locale: the path below the current base (`/fr/`) moves below the other
 * locale's segment, and the query and fragment are kept (`/fr/atelier-nord/home?x#y` becomes
 * `/en/atelier-nord/home?x#y`).
 *
 * @param {PageAddress} address - The current address.
 * @param {string} base - The current base href (`/fr/`), as the document declares it.
 * @param {AppLocale} locale - The locale to open.
 * @returns {string} The root-relative address of the page in that locale.
 */
export function localeAddress(address: PageAddress, base: string, locale: AppLocale): string {
  const root: string = base.endsWith('/') ? base : `${base}/`;
  const { pathname, search, hash }: PageAddress = address;
  const below: string = `${pathname}/`.startsWith(root)
    ? pathname.slice(root.length)
    : pathname.replace(/^\/+/u, '');
  return `/${locale}/${below}${search}${hash}`;
}

/**
 * Function localeCookie
 *
 * @description
 * The cookie text that remembers a locale for the whole site for a year, `Secure` when the page is
 * served over HTTPS. It holds the locale code only.
 *
 * @param {AppLocale} locale - The chosen locale.
 * @param {boolean} secure - Whether the page is served over HTTPS.
 * @returns {string} The text to assign to `document.cookie`.
 */
export function localeCookie(locale: AppLocale, secure: boolean): string {
  const cookie: string = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${String(LOCALE_COOKIE_MAX_AGE)}; SameSite=Lax`;
  return secure ? `${cookie}; Secure` : cookie;
}
