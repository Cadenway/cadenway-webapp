/**
 * Function takesSingular
 *
 * @description
 * Whether a count reads with the singular form in the running locale: English says `1 open task`
 * and `0 open tasks`, while French takes the singular for 0 and 1. The locale is the one `core/locale`
 * installed in `$localize.locale` before bootstrap; English without it.
 *
 * @param {number} count - The count shown.
 * @returns {boolean} Whether the singular text applies.
 */
export function takesSingular(count: number): boolean {
  return new Intl.PluralRules($localize.locale ?? 'en').select(count) === 'one';
}
