import type { ListMembersClientResult } from '@cadenway/api-client';

import type { Person } from '../../../models/person/person.interface';
import { personOf } from '../../../utils/person/person.util';

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
  return personOf(member.userId, member.name);
}
