import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { type EnvironmentProviders, LOCALE_ID, makeEnvironmentProviders } from '@angular/core';

/**
 * Constant SOURCE_LOCALE
 *
 * @description
 * Locale of the authored English source copy, used when no translated build set `$localize.locale`.
 *
 * @type {string}
 */
const SOURCE_LOCALE: string = 'en';

/**
 * Function provideAppLocale
 *
 * @description
 * Formats Angular dates and numbers in the locale of the build: French for the served
 * translation, English for the unlocalized source build. French formatting data is registered
 * once for the translated build and its tests. The `@cadenway/ui` bricks receive the same locale
 * from the layout routes, so their core chunk stays out of the initial bundle.
 *
 * @returns {EnvironmentProviders} The root locale providers.
 */
export function provideAppLocale(): EnvironmentProviders {
  registerLocaleData(localeFr);
  return makeEnvironmentProviders([
    { provide: LOCALE_ID, useFactory: (): string => $localize.locale ?? SOURCE_LOCALE },
  ]);
}
