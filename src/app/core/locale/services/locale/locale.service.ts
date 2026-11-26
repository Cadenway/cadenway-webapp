import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';

import { APP_LOCALES, DEFAULT_LOCALE } from '../../constants/locale/locale.constants';
import type { AppLocale } from '../../models/locale/locale.type';
import { isAppLocale, localeAddress } from '../../utils/locale-selection/locale-selection.utils';

/**
 * Service LocaleService
 *
 * @description
 * Reads the locale the application was loaded in and switches it. Messages are translated once,
 * before bootstrap, so a switch reloads the current page with `?lang=`, which the next load
 * remembers on the device. A future account preference calls `use` the same way.
 */
@Service()
export class LocaleService {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * Document whose location is reloaded.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property current
   *
   * @description
   * Locale of this load, as installed in `$localize.locale` before bootstrap.
   *
   * @type {AppLocale}
   * @readonly
   */
  public readonly current: AppLocale = isAppLocale($localize.locale)
    ? $localize.locale
    : DEFAULT_LOCALE;

  /**
   * Property available
   *
   * @description
   * Every locale the application can be shown in.
   *
   * @type {readonly AppLocale[]}
   * @readonly
   */
  public readonly available: readonly AppLocale[] = APP_LOCALES;
  // #endregion

  // #region Methods
  /**
   * Method use
   *
   * @description
   * Reloads the current page in another locale; does nothing for the current one.
   *
   * @param {AppLocale} locale - Locale to switch to.
   */
  public use(locale: AppLocale): void {
    if (locale === this.current) return;
    this.document.location.assign(localeAddress(this.document.location.href, locale));
  }
  // #endregion
}
