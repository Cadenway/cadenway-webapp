import { DOCUMENT, inject, Service, signal, type WritableSignal } from '@angular/core';

import type { TaskSearchResult } from '../../models/search-result/search-result.interface';

/**
 * Constant LIMIT
 *
 * @description
 * Tasks the « Tâches récentes » group keeps, the most recent first.
 *
 * @type {number}
 */
const LIMIT: number = 5;

/**
 * Constant STATUSES
 *
 * @description
 * Status keys a stored entry may carry; anything else is dropped as corrupt.
 *
 * @type {ReadonlySet<string>}
 */
const STATUSES: ReadonlySet<string> = new Set([
  'triage',
  'backlog',
  'todo',
  'progress',
  'review',
  'testing',
  'waiting',
  'blocked',
  'done',
  'cancelled',
]);

/**
 * Function isRecentTask
 *
 * @description
 * Checks one stored entry, since the storage may be edited or written by another version.
 *
 * @param {unknown} value - A parsed entry.
 * @returns {boolean} Whether it is a task the palette can show.
 */
function isRecentTask(value: unknown): value is TaskSearchResult {
  if (typeof value !== 'object' || value === null) return false;
  const entry: Partial<Record<keyof TaskSearchResult, unknown>> = value;
  return (
    entry.kind === 'task' &&
    typeof entry.key === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.status === 'string' &&
    STATUSES.has(entry.status)
  );
}

/**
 * Service RecentTasks
 *
 * @description
 * The palette's « Tâches récentes »: the last tasks opened from the palette, kept in this
 * browser's `localStorage` per person and organization
 * (`cadenway-recent-tasks:<userId>:<organizationId>`), so neither another person on the device nor
 * another organization sees them. Auth's `SignOut` removes every key with this prefix. Inaccessible
 * storage reads as an empty history and ignores writes. Opening a task from its own page will add to it once the task page exists
 * (step 5); until then only the palette writes it.
 */
@Service()
export class RecentTasks {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * Document whose window holds the storage.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property revision
   *
   * @description
   * Bumped on every write, so readers in a reactive context read the history again.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  private readonly revision: WritableSignal<number> = signal(0);
  // #endregion

  // #region Methods
  /**
   * Method list
   *
   * @description
   * The person's recent tasks in an organization, the most recent first. Reactive to `remember`.
   *
   * @param {string} userId - The signed-in person.
   * @param {string} organizationId - Organization of the workspace.
   * @returns {readonly TaskSearchResult[]} At most five tasks.
   */
  public list(userId: string, organizationId: string): readonly TaskSearchResult[] {
    this.revision();
    try {
      const raw: string | null | undefined = this.document.defaultView?.localStorage.getItem(
        this.key(userId, organizationId),
      );
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isRecentTask).slice(0, LIMIT) : [];
    } catch {
      return [];
    }
  }

  /**
   * Method remember
   *
   * @description
   * Puts a task first in the person's history for an organization, without duplicates.
   *
   * @param {string} userId - The signed-in person.
   * @param {string} organizationId - Organization of the workspace.
   * @param {TaskSearchResult} task - The opened task.
   */
  public remember(userId: string, organizationId: string, task: TaskSearchResult): void {
    const next: readonly TaskSearchResult[] = [
      task,
      ...this.list(userId, organizationId).filter(
        (entry: TaskSearchResult) => entry.key !== task.key,
      ),
    ].slice(0, LIMIT);
    try {
      this.document.defaultView?.localStorage.setItem(
        this.key(userId, organizationId),
        JSON.stringify(next),
      );
    } catch {
      return;
    }
    this.revision.update((value: number) => value + 1);
  }

  /**
   * Method key
   *
   * @description
   * Storage key of a person's history in an organization.
   *
   * @param {string} userId - The signed-in person.
   * @param {string} organizationId - Organization of the workspace.
   * @returns {string} The storage key.
   */
  private key(userId: string, organizationId: string): string {
    return `cadenway-recent-tasks:${userId}:${organizationId}`;
  }
  // #endregion
}
