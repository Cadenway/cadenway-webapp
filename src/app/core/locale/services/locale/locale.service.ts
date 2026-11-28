import { DOCUMENT, PlatformLocation } from '@angular/common';
import { inject, Service } from '@angular/core';

import { APP_LOCALES, DEFAULT_LOCALE } from '../../constants/locale/locale.constants';
import type { AppLocale } from '../../models/locale/locale.type';
import {
  isAppLocale,
  localeAddress,
  localeCookie,
} from '../../utils/locale-address/locale-address.utils';

/**
 * Service LocaleService
 *
 * @description
 * Reads the locale the application was built in and switches it. Each locale is a separate build
 * served below its own segment (`/en/`, `/fr/`), so a switch remembers the choice in the
 * `cw_locale` cookie, then opens the same page below the other segment with a full navigation,
 * its query and fragment kept. The account preference calls `use` the same way.
 */
@Service()
export class LocaleService {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * Document whose cookie is written and whose location is navigated.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property platformLocation
   *
   * @description
   * The current address and the document's base href (`/fr/`).
   *
   * @type {PlatformLocation}
   * @readonly
   */
  private readonly platformLocation: PlatformLocation = inject(PlatformLocation);

  /**
   * Property current
   *
   * @description
   * Locale of this build, as the localized build sets `$localize.locale`, which Angular's default
   * `LOCALE_ID` reads too.
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
   * Every locale the application is built in.
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
   * Remembers a locale in the `cw_locale` cookie and, when it is not the current one, opens the
   * current page in it.
   *
   * @param {AppLocale} locale - Locale to switch to.
   */
  public use(locale: AppLocale): void {
    this.document.cookie = localeCookie(locale, this.document.location.protocol === 'https:');
    if (locale === this.current) return;
    this.document.location.assign(
      localeAddress(this.platformLocation, this.platformLocation.getBaseHrefFromDOM(), locale),
    );
  }
  // #endregion
}
