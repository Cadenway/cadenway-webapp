import type { Person } from '../../models/person/person.interface';

/**
 * Function initialsOf
 *
 * @description
 * The initials of a name: the first letters of its first and last words, in capitals (`CM` for
 * Camille Martin, `H` for Hugo).
 *
 * @param {string} name - Full name.
 * @returns {string} One or two capital letters, or an empty string for a blank name.
 */
export function initialsOf(name: string): string {
  const words: readonly string[] = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return '';
  const first: string = words[0].charAt(0);
  const last: string = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toLocaleUpperCase();
}

/**
 * Function personOf
 *
 * @description
 * The person of the pickers and avatars for a member another feature already read, identified by
 * the user id that task assignees use. The avatar stays null: members give no picture address.
 *
 * @param {string} userId - User id of the member.
 * @param {string} name - Full name of the member.
 * @returns {Person} The display model.
 */
export function personOf(userId: string, name: string): Person {
  return { id: userId, name, initials: initialsOf(name), avatar: null };
}
