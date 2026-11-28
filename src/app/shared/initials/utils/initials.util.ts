/**
 * Function initialsOf
 *
 * @description
 * The one initials rule of the application, for an organization or a person: the first letters of
 * the first and last words of a name (`Atelier Nord` gives `AN`, `Atelier Nord Est` gives `AE`), or
 * the first two letters of a single word (`Cadenway` gives `CA`), upper-cased. Letters outside the
 * Basic Multilingual Plane count as one character. The rail, the settings navigation, the
 * organization logo tile and the organization choice all derive the same mark from it.
 *
 * @param {string} name - Full name of an organization or a person.
 * @returns {string} One or two upper-case letters, or an empty string for a blank name.
 */
export function initialsOf(name: string): string {
  const words: readonly string[] = name.trim().split(/\s+/u).filter(Boolean);
  const first: string = words.at(0) ?? '';
  const last: string = words.length > 1 ? (words.at(-1) ?? '') : '';
  const letters: string = last
    ? `${Array.from(first)[0] ?? ''}${Array.from(last)[0] ?? ''}`
    : Array.from(first).slice(0, 2).join('');
  return letters.toLocaleUpperCase();
}
