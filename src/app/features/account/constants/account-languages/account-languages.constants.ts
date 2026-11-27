import type { AccountLanguageOption } from '../../data-access/services/language-api/account-language.interface';

/**
 * Constant ACCOUNT_LANGUAGE_OPTIONS
 *
 * @description
 * The languages of the preferences section in the mockup's order, each named in its own language
 * and with the mockup's flag (`Compte.dc.html` lines 1434 and 1660).
 *
 * @type {readonly AccountLanguageOption[]}
 */
export const ACCOUNT_LANGUAGE_OPTIONS: readonly AccountLanguageOption[] = [
  { value: 'fr', label: $localize`:@@account.preferences.language-fr:Français`, flag: 'flagFr' },
  { value: 'en', label: $localize`:@@account.preferences.language-en:English`, flag: 'flagGb' },
  { value: 'de', label: $localize`:@@account.preferences.language-de:Deutsch`, flag: 'flagDe' },
  { value: 'es', label: $localize`:@@account.preferences.language-es:Español`, flag: 'flagEs' },
];
