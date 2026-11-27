/**
 * Function takesSingular
 *
 * @description
 * Whether a count reads with the singular form in the running locale: English says `1 member`
 * and `0 members`, French `0 membre` and `1 membre`, as the mockup's `plural()` does. The locale
 * is the one `core/locale` installed in `$localize.locale` before bootstrap; English without it.
 *
 * @param {number} count - The count shown.
 * @returns {boolean} Whether the singular text applies.
 */
export function takesSingular(count: number): boolean {
  return new Intl.PluralRules($localize.locale ?? 'en').select(count) === 'one';
}
