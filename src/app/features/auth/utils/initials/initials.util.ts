/**
 * Function initials
 *
 * @description
 * The mark of a name as `Organisations.dc.html` draws it: the first letter of its first two words,
 * upper-cased (« Atelier Nord » gives « AN », « Coopérative Lumen » gives « CL »). Letters outside
 * the Basic Multilingual Plane count as one character. A blank name gives an empty string.
 *
 * @param {string} name - The organization or draft name.
 * @returns {string} Up to two upper-case letters.
 */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .filter((word: string) => word !== '')
    .slice(0, 2)
    .map((word: string) => (Array.from(word)[0] ?? '').toUpperCase())
    .join('');
}
