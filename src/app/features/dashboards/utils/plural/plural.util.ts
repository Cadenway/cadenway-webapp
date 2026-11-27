/**
 * Function takesSingular
 *
 * @description
 * Whether a count reads with the singular form in the running locale: English says `1 task` and
 * `0 tasks`, while French takes the singular for 0 too. The locale is the one `core/locale` installed in
 * `$localize.locale` before bootstrap; English without it.
 *
 * @param {number} count - The count shown.
 * @returns {boolean} Whether the singular text applies.
 */
export function takesSingular(count: number): boolean {
  return new Intl.PluralRules($localize.locale ?? 'en').select(count) === 'one';
}
