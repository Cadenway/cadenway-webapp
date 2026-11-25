import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_PARAMETER,
  LOCALE_STORAGE_KEY,
} from '../../constants/locale/locale.constants';
import type { AppLocale } from '../../models/locale/locale.type';

/**
 * Function isAppLocale
 *
 * @description
 * Tells whether a value names a locale the application can be shown in.
 *
 * @param {unknown} value - Value to check.
 * @returns {boolean} Whether the value is an `AppLocale`.
 */
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

/**
 * Function selectLocale
 *
 * @description
 * Chooses the locale of this load. A supported `?lang=` parameter wins and is remembered on the
 * device; otherwise the remembered choice applies, else English. Inaccessible storage is ignored.
 *
 * @param {Window} view - Window whose address and storage are read.
 * @returns {AppLocale} The locale to show.
 */
export function selectLocale(view: Window): AppLocale {
  const requested: string | undefined = new URLSearchParams(view.location.search)
    .get(LOCALE_PARAMETER)
    ?.toLowerCase();
  if (isAppLocale(requested)) {
    try {
      view.localStorage.setItem(LOCALE_STORAGE_KEY, requested);
    } catch {
      /* Storage may be unavailable: the parameter still applies to this load. */
    }
    return requested;
  }
  try {
    const remembered: string | null = view.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(remembered) ? remembered : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Function localeAddress
 *
 * @description
 * Builds an address with `?lang=` set to a locale, its other parameters and fragment kept.
 *
 * @param {string} current - The absolute address to start from.
 * @param {AppLocale} locale - Locale to select.
 * @returns {string} The address that loads the application in that locale.
 */
export function localeAddress(current: string, locale: AppLocale): string {
  const address: URL = new URL(current);
  address.searchParams.set(LOCALE_PARAMETER, locale);
  return address.href;
}
