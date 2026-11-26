import { inject, Service } from '@angular/core';
import {
  type CreateTaskTimeEntryClientResult,
  type ListTaskTimeEntriesClientResult,
  TaskTimeService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type {
  TaskTimeDraft,
  TaskTimeEntry,
  TaskTimeLog,
} from '../../../models/task-time/task-time.interface';
import { toTaskTimeEntry } from '../../adapters/task-time/task-time.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Page size of the time entries, read to their last cursor page.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Service TaskTimeApi
 *
 * @description
 * The time recorded on a task through the generated client: its entries with their totals,
 * an entry created under an `Idempotency-Key` (so a retried request records once), and an
 * entry deleted (only its author with `edit` may). Recording does not change the task version.
 */
@Service()
export class TaskTimeApi {
  // #region Properties
  /**
   * Property time
   *
   * @description
   * Generated time operations.
   *
   * @type {TaskTimeService}
   * @readonly
   */
  private readonly time: TaskTimeService = inject(TaskTimeService);
  // #endregion

  // #region Methods
  /**
   * Method log
   *
   * @description
   * Reads the entries of the task, newest first, without the HTTP cache.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskTimeLog>} The entries and their total.
   */
  public async log(taskKey: string): Promise<TaskTimeLog> {
    const entries: TaskTimeEntry[] = [];
    let page: ListTaskTimeEntriesClientResult;
    let cursor: string | undefined;
    do {
      page = await firstValueFrom(
        this.time.listTaskTimeEntries(taskKey, { limit: PAGE_SIZE, cursor }, { cache: 'no-store' }),
      );
      entries.push(...page.items.map(toTaskTimeEntry));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return { entries, totalMinutes: page.totalMinutes };
  }

  /**
   * Method record
   *
   * @description
   * Records time on the task for a work day, the caller as its author.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskTimeDraft} draft - Minutes (1 to 1,440) and note.
   * @param {string} workDate - Day of the work (`YYYY-MM-DD`).
   * @param {string} idempotencyKey - Key of the request.
   * @returns {Promise<TaskTimeEntry>} The entry.
   */
  public async record(
    taskKey: string,
    draft: TaskTimeDraft,
    workDate: string,
    idempotencyKey: string,
  ): Promise<TaskTimeEntry> {
    const note: string = draft.note.trim();
    const entry: CreateTaskTimeEntryClientResult = await firstValueFrom(
      this.time.createTaskTimeEntry(
        taskKey,
        { minutes: draft.minutes, workDate, ...(note ? { note } : {}) },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    return toTaskTimeEntry(entry);
  }

  /**
   * Method remove
   *
   * @description
   * Deletes an entry of the task.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} entryId - Id of the entry.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async remove(taskKey: string, entryId: string): Promise<void> {
    await firstValueFrom(this.time.deleteTaskTimeEntry(taskKey, entryId));
  }
  // #endregion
}
