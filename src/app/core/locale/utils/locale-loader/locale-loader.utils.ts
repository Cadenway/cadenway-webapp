import { registerLocaleData } from '@angular/common';
import { loadTranslations } from '@angular/localize';

import { DEFAULT_LOCALE, FRENCH_CATALOG_PATH } from '../../constants/locale/locale.constants';
import type { AppLocale } from '../../models/locale/locale.type';
import { selectLocale } from '../locale-selection/locale-selection.utils';

/**
 * Function loadLocale
 *
 * @description
 * Prepares the locale of this load before the application bootstraps, so that every `$localize`
 * message, module-level constants included, is read in it. English is the source copy and loads
 * nothing. French fetches its catalog and locale data, then installs them; when either fails, the
 * application starts in English and the failure is logged. Sets `$localize.locale`, which
 * Angular's default `LOCALE_ID` reads, and the document language.
 *
 * @param {Window} view - Window whose address, storage and document are used.
 * @returns {Promise<AppLocale>} The locale the application starts in.
 */
export async function loadLocale(view: Window): Promise<AppLocale> {
  let locale: AppLocale = selectLocale(view);
  if (locale === 'fr') {
    try {
      await loadFrench(view.document.baseURI);
    } catch (error: unknown) {
      console.error(error);
      locale = DEFAULT_LOCALE;
    }
  }
  $localize.locale = locale;
  view.document.documentElement.lang = locale;
  return locale;
}

/**
 * Function readCatalog
 *
 * @description
 * Validates a French translation catalog in Angular's JSON format.
 *
 * @param {unknown} value - Parsed JSON of the catalog.
 * @returns {Record<string, string>} The translations by message id.
 * @throws {TypeError} When the value is not a French catalog of string translations.
 */
export function readCatalog(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('The French catalog must contain a JSON object.');
  }
  const catalog: Partial<Record<'locale' | 'translations', unknown>> = value;
  const translations: unknown = catalog.translations;
  if (
    catalog.locale !== 'fr' ||
    typeof translations !== 'object' ||
    translations === null ||
    Object.values(translations).some((text: unknown): boolean => typeof text !== 'string')
  ) {
    throw new TypeError('The French catalog must hold "fr" string translations.');
  }
  return translations as Record<string, string>;
}

/**
 * Function loadFrench
 *
 * @description
 * Fetches the French catalog and locale data in parallel, then installs them.
 *
 * @param {string} base - Document base address the catalog path is resolved against.
 * @returns {Promise<void>} Resolves once the French messages and formatting data are installed.
 * @throws {Error} When the catalog cannot be fetched or is invalid.
 */
async function loadFrench(base: string): Promise<void> {
  const [response, data]: [Response, typeof import('@angular/common/locales/fr')] =
    await Promise.all([
      fetch(new URL(FRENCH_CATALOG_PATH, base)),
      import('@angular/common/locales/fr'),
    ]);
  if (!response.ok) {
    throw new Error(`The French catalog could not be loaded (HTTP ${String(response.status)}).`);
  }
  loadTranslations(readCatalog(await response.json()));
  registerLocaleData(data.default);
}
