/**
 * Function takesSingular
 *
 * @description
 * Whether a count reads with the singular form in the running locale: English says `1 key result`
 * and `0 key results`, while French takes the singular for 0 and 1, as the mockup's count of key
 * results does (`App.dc.html` line 5132). The locale is the one `core/locale` installed in
 * `$localize.locale` before bootstrap; English without it.
 *
 * @param {number} count - The count shown.
 * @returns {boolean} Whether the singular text applies.
 */
export function takesSingular(count: number): boolean {
  return new Intl.PluralRules($localize.locale ?? 'en').select(count) === 'one';
}
