import type { TrashEntry as TrashEntryDto, TrashRestored } from '@cadenway/api-client';

import type { TrashActorKind, TrashEntry } from '../../../models/trash-entry/trash-entry.interface';
import type { TrashRestore } from '../../../models/trash-restore/trash-restore.interface';

/**
 * Function toActorKind
 *
 * @description
 * Reads the type of an actor; the contract may add types, which the page does not name.
 *
 * @param {string} type - `Actor.type` of the contract.
 * @returns {TrashActorKind} The kind of actor the row names.
 */
function toActorKind(type: string): TrashActorKind {
  if (type === 'user' || type === 'automation') return type;
  return 'other';
}

/**
 * Function toTrashEntry
 *
 * @description
 * Keeps what the trash row shows of an entry. A list whose state is `deleted` reads as a deleted
 * list; any other state (`active`, `archived` or a later one) keeps its name.
 *
 * @param {TrashEntryDto} entry - Item of `GET /v1/trash`.
 * @returns {TrashEntry} Display model of the entry.
 */
export function toTrashEntry(entry: TrashEntryDto): TrashEntry {
  return {
    id: entry.id,
    taskKey: entry.task.key,
    taskName: entry.task.name,
    status: entry.task.status,
    parentKey: entry.parentKey,
    subtaskCount: entry.subtaskCount,
    listName: entry.list.name,
    listDeleted: entry.list.state === 'deleted',
    trashedAt: entry.trashedAt,
    trashedBy: { kind: toActorKind(entry.trashedBy.type), id: entry.trashedBy.id },
    purgeAt: entry.purgeAt,
  };
}

/**
 * Function toTrashRestore
 *
 * @description
 * Keeps what the restore toast says of a restored entry.
 *
 * @param {TrashRestored} restored - Answer of `POST /v1/trash/{entryId}/restore`.
 * @returns {TrashRestore} Display model of the restore.
 */
export function toTrashRestore(restored: TrashRestored): TrashRestore {
  return {
    taskKey: restored.task.key,
    taskName: restored.task.name,
    status: restored.task.status,
    listName: restored.list.name,
    subtaskCount: restored.subtaskCount,
    detached: restored.detached,
  };
}
