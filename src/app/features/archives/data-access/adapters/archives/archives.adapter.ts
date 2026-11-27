import type { ArchivedList, ArchivedTask, ListMembersClientResult } from '@cadenway/api-client';

import type { ArchivedListItem } from '../../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../../models/archived-task/archived-task.interface';

/**
 * Type ArchiveActor
 *
 * @description
 * Who archived an item, as the gateway sends it: a person (`user`, `id` is the account) or
 * another actor (`automation`, `git`, `system`, or a later type).
 *
 * @type {{ readonly type: string; readonly id: string } | null | undefined}
 */
type ArchiveActor = { readonly type: string; readonly id: string } | null | undefined;

/**
 * Function personId
 *
 * @description
 * The account of the person who archived an item; another actor has no name to show.
 *
 * @param {ArchiveActor} actor - The gateway's actor.
 * @returns {string | null} The account id, or null for no person.
 */
function personId(actor: ArchiveActor): string | null {
  return actor?.type === 'user' ? actor.id : null;
}

/**
 * Function toArchivedListItem
 *
 * @description
 * Maps an archived list of the gateway to the row of the `Lists` tab. Restoring needs `edit` on
 * the list; a list sent without `callerRole` reads as `edit`, any other role as not restorable.
 *
 * @param {ArchivedList} entry - The gateway's archived list.
 * @returns {ArchivedListItem} The display model.
 */
export function toArchivedListItem(entry: ArchivedList): ArchivedListItem {
  const role: string | undefined = entry.list.callerRole;
  return {
    id: entry.list.id,
    name: entry.list.name,
    spaceId: entry.list.spaceId,
    sprint: entry.list.sprint !== null,
    taskCount: entry.taskCount,
    archivedAt: entry.list.archivedAt ?? null,
    archivedBy: personId(entry.list.archivedBy),
    restorable: role === undefined || role === 'edit',
  };
}

/**
 * Function toArchivedTaskItem
 *
 * @description
 * Maps an archived root of the gateway to the row of the `Tasks` tab. Only the `archived` state
 * of its list replaces the list name; any other state keeps it.
 *
 * @param {ArchivedTask} entry - The gateway's archived task.
 * @returns {ArchivedTaskItem} The display model.
 */
export function toArchivedTaskItem(entry: ArchivedTask): ArchivedTaskItem {
  return {
    key: entry.task.key,
    name: entry.task.name,
    status: entry.task.status,
    milestone: entry.task.milestone === true,
    listId: entry.list.id,
    listName: entry.list.name,
    listArchived: entry.list.state === 'archived',
    archivedAt: entry.archivedAt,
    archivedBy: personId(entry.archivedBy),
  };
}

/**
 * Function toMemberName
 *
 * @description
 * The account and display name of a member, for the `by` of a row.
 *
 * @param {ListMembersClientResult['items'][number]} member - A member of the organization.
 * @returns {readonly [string, string]} Its account id and name.
 */
export function toMemberName(
  member: ListMembersClientResult['items'][number],
): readonly [string, string] {
  return [member.userId, member.name];
}
