/**
 * Function bulkDoneText
 *
 * @description
 * Names the tasks marked done by a bulk action.
 *
 * @param {number} count - Number of tasks changed.
 * @returns {string} The localized toast title.
 */
export function bulkDoneText(count: number): string {
  return count === 1
    ? $localize`:@@spaces.bulk.done-toast-one:${count}:count: task done`
    : $localize`:@@spaces.bulk.done-toast-many:${count}:count: tasks done`;
}

/**
 * Function bulkMovedText
 *
 * @description
 * Names the tasks moved by a bulk action.
 *
 * @param {number} count - Number of tasks changed.
 * @returns {string} The localized toast title.
 */
export function bulkMovedText(count: number): string {
  return count === 1
    ? $localize`:@@spaces.bulk.moved-one:${count}:count: task moved`
    : $localize`:@@spaces.bulk.moved-many:${count}:count: tasks moved`;
}

/**
 * Function bulkDeletedText
 *
 * @description
 * Names the tasks deleted by a bulk action.
 *
 * @param {number} count - Number of tasks changed.
 * @returns {string} The localized toast title.
 */
export function bulkDeletedText(count: number): string {
  return count === 1
    ? $localize`:@@spaces.bulk.deleted-one:${count}:count: task deleted`
    : $localize`:@@spaces.bulk.deleted-many:${count}:count: tasks deleted`;
}

/**
 * Function bulkUpdatedText
 *
 * @description
 * Describes how many tasks a bulk action updated.
 *
 * @param {number} count - Number of tasks changed.
 * @returns {string} The localized toast description.
 */
export function bulkUpdatedText(count: number): string {
  return count === 1
    ? $localize`:@@spaces.bulk.updated-one:${count}:count: task updated.`
    : $localize`:@@spaces.bulk.updated-many:${count}:count: tasks updated.`;
}

/**
 * Function bulkPartialText
 *
 * @description
 * Describes the selected tasks whose chunk was refused.
 *
 * @param {number} failed - Number of tasks refused.
 * @param {number} total - Number of tasks selected.
 * @returns {string} The localized error title.
 */
export function bulkPartialText(failed: number, total: number): string {
  return failed === 1
    ? $localize`:@@spaces.bulk.partial-one:${failed}:failed: of ${total}:total: tasks could not be changed`
    : $localize`:@@spaces.bulk.partial-many:${failed}:failed: of ${total}:total: tasks could not be changed`;
}

/**
 * Function undoConflictTitle
 *
 * @description
 * Names the tasks an `Undo` skipped because they changed after the undone action: the key of a
 * single task, or their count.
 *
 * @param {readonly string[]} keys - Keys of the skipped tasks, at least one.
 * @returns {string} The localized warning title.
 */
export function undoConflictTitle(keys: readonly string[]): string {
  const count: number = keys.length;
  const key: string = keys[0] ?? '';
  return count === 1
    ? $localize`:@@spaces.undo.conflict-one:${key}:key: changed since`
    : $localize`:@@spaces.undo.conflict-many:${count}:count: tasks changed since`;
}

/**
 * Function undoConflictText
 *
 * @description
 * Says that an `Undo` left the tasks that changed since as they are now.
 *
 * @param {number} count - Number of skipped tasks.
 * @returns {string} The localized warning description.
 */
export function undoConflictText(count: number): string {
  return count === 1
    ? $localize`:@@spaces.undo.conflict-one-text:Undo skipped it: its latest values are shown.`
    : $localize`:@@spaces.undo.conflict-many-text:Undo skipped them: their latest values are shown.`;
}
