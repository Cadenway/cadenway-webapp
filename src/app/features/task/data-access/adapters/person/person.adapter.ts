import type { ListMembersClientResult } from '@cadenway/api-client';

import type { Person } from '../../../models/person/person.interface';

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
 * Function toPerson
 *
 * @description
 * Maps a member of the organization to a person of the pickers, identified by the user id that
 * task assignees use.
 *
 * @param {ListMembersClientResult['items'][number]} member - A member returned by the gateway.
 * @returns {Person} The display model.
 */
export function toPerson(member: ListMembersClientResult['items'][number]): Person {
  return { id: member.userId, name: member.name, initials: initialsOf(member.name), avatar: null };
}
