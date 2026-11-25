import type { AppLocale } from '../../models/locale/locale.type';

/**
 * Constant DEFAULT_LOCALE
 *
 * @description
 * The locale of the source copy, shown when nothing selects another one.
 *
 * @type {AppLocale}
 */
export const DEFAULT_LOCALE: AppLocale = 'en';

/**
 * Constant APP_LOCALES
 *
 * @description
 * Every locale the application can be shown in, the default first.
 *
 * @type {readonly AppLocale[]}
 */
export const APP_LOCALES: readonly AppLocale[] = ['en', 'fr'];

/**
 * Constant LOCALE_PARAMETER
 *
 * @description
 * Query parameter that selects the locale on load (`?lang=fr`, `?lang=en`).
 *
 * @type {string}
 */
export const LOCALE_PARAMETER: string = 'lang';

/**
 * Constant LOCALE_STORAGE_KEY
 *
 * @description
 * Local storage key under which the device remembers the last selected locale.
 *
 * @type {string}
 */
export const LOCALE_STORAGE_KEY: string = 'cadenway-locale';

/**
 * Constant FRENCH_CATALOG_PATH
 *
 * @description
 * Address of the French translation catalog, relative to the document base. The build copies
 * `src/locale/messages.fr.json` there.
 *
 * @type {string}
 */
export const FRENCH_CATALOG_PATH: string = 'i18n/messages.fr.json';
