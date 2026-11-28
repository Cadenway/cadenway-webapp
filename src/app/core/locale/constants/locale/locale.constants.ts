import type { AppLocale } from '../../models/locale/locale.type';

/**
 * Constant DEFAULT_LOCALE
 *
 * @description
 * The locale of the source copy, served when nothing selects another one.
 *
 * @type {AppLocale}
 */
export const DEFAULT_LOCALE: AppLocale = 'en';

/**
 * Constant APP_LOCALES
 *
 * @description
 * Every locale the application is built in, the default first. Each one is a separate build served
 * below its own first path segment (`/en/`, `/fr/`), the `baseHref` of its `angular.json` locale.
 *
 * @type {readonly AppLocale[]}
 */
export const APP_LOCALES: readonly AppLocale[] = ['en', 'fr'];

/**
 * Constant LOCALE_COOKIE
 *
 * @description
 * First-party cookie that remembers the locale a person chose. The web server reads it to send an
 * address without a locale segment (`/`, an e-mail link) to `/<locale>/…`; it holds the locale code
 * only.
 *
 * @type {string}
 */
export const LOCALE_COOKIE: string = 'cw_locale';

/**
 * Constant LOCALE_COOKIE_MAX_AGE
 *
 * @description
 * How long the locale cookie is kept, in seconds: one year.
 *
 * @type {number}
 */
export const LOCALE_COOKIE_MAX_AGE: number = 31_536_000;
