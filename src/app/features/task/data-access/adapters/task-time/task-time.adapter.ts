import type { CreateTaskTimeEntryClientResult } from '@cadenway/api-client';

import type { TaskTimeEntry } from '../../../models/task-time/task-time.interface';

/**
 * Function toTaskTimeEntry
 *
 * @description
 * Maps a time entry of the gateway; a missing note reads as an empty string.
 *
 * @param {CreateTaskTimeEntryClientResult} entry - The entry.
 * @returns {TaskTimeEntry} The display model.
 */
export function toTaskTimeEntry(entry: CreateTaskTimeEntryClientResult): TaskTimeEntry {
  return {
    id: entry.id,
    authorId: entry.authorUserId,
    minutes: entry.minutes,
    workDate: entry.workDate,
    note: entry.note ?? '',
    createdAt: entry.createdAt,
  };
}
