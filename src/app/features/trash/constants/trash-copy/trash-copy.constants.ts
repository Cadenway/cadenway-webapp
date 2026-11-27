import type { TrashRestore } from '../../models/trash-restore/trash-restore.interface';

/**
 * Constant TRASH_CONFIRM_WORD
 *
 * @description
 * The word `Empty the trash` asks to type (`typeName: 'corbeille'`, `App.dc.html` line 8406), in
 * the current language.
 *
 * @type {string}
 */
export const TRASH_CONFIRM_WORD: string = $localize`:@@trash.empty-dialog.word:trash`;

/**
 * Constant TRASH_CONFIRM_LABEL
 *
 * @description
 * The prompt before the word to type (`App.dc.html` line 3510), for `cw-alert-dialog`.
 *
 * @type {string}
 */
export const TRASH_CONFIRM_LABEL: string = $localize`:@@trash.labels.confirm:To confirm, type`;

/**
 * Constant TRASH_FORMER_MEMBER
 *
 * @description
 * The name of a person who deleted an entry and is no longer in the member directory.
 *
 * @type {string}
 */
export const TRASH_FORMER_MEMBER: string = $localize`:@@trash.row.former-member:Former member`;

/**
 * Constant TRASH_AUTOMATION
 *
 * @description
 * The author of an entry an automation rule deleted.
 *
 * @type {string}
 */
export const TRASH_AUTOMATION: string = $localize`:@@trash.row.automation:An automation`;

/**
 * Constant TRASH_TOAST_OPEN
 *
 * @description
 * The action of the restore toast, which opens the restored task (`App.dc.html` line 8753).
 *
 * @type {string}
 */
export const TRASH_TOAST_OPEN: string = $localize`:@@trash.toast.open:Open`;

/**
 * Constant TRASH_ALREADY_RESTORED
 *
 * @description
 * A restore whose entry is no longer in the trash (Errors' `Already restored`).
 *
 * @type {string}
 */
export const TRASH_ALREADY_RESTORED: string = $localize`:@@trash.toast.already-restored:Already restored`;

/**
 * Constant TRASH_PURGED_TEXT
 *
 * @description
 * The description of the purge toast (`App.dc.html` line 8416).
 *
 * @type {string}
 */
export const TRASH_PURGED_TEXT: string = $localize`:@@trash.toast.purged-text:Deleted for good.`;

/**
 * Constant TRASH_EMPTIED
 *
 * @description
 * The title of the toast once the trash is emptied (`App.dc.html` line 8406).
 *
 * @type {string}
 */
export const TRASH_EMPTIED: string = $localize`:@@trash.toast.emptied:Trash emptied`;

/**
 * Constant TRASH_EMPTY_FAILED
 *
 * @description
 * The title of the toast when the gateway refuses to empty the trash.
 *
 * @type {string}
 */
export const TRASH_EMPTY_FAILED: string = $localize`:@@trash.toast.empty-failed:Could not empty the trash`;

/**
 * Constant TRASH_UNCONFIRMED
 *
 * @description
 * The title of the toast when a write got no answer and the trash could not be read again to see
 * whether it was applied.
 *
 * @type {string}
 */
export const TRASH_UNCONFIRMED: string = $localize`:@@trash.toast.unconfirmed:Could not confirm the change`;

/**
 * Constant TRASH_UNCONFIRMED_TEXT
 *
 * @description
 * The description of the unconfirmed toast.
 *
 * @type {string}
 */
export const TRASH_UNCONFIRMED_TEXT: string = $localize`:@@trash.toast.unconfirmed-text:Check the trash again in a moment.`;

/**
 * Function trashRestoredTitle
 *
 * @description
 * The title of the restore toast (`CAD-452 restored`).
 *
 * @param {string} key - Key of the restored task.
 * @returns {string} The title.
 */
export function trashRestoredTitle(key: string): string {
  return $localize`:@@trash.toast.restored:${key}:key: restored`;
}

/**
 * Function trashRestoredText
 *
 * @description
 * The description of the restore toast (`App.dc.html` line 8385): the subtasks that came back,
 * the list the task is back in and whether it left its deleted parent.
 *
 * @param {Pick<TrashRestore, 'listName' | 'subtaskCount' | 'detached'>} restore - What came back.
 * @returns {string} The description.
 */
export function trashRestoredText(
  restore: Pick<TrashRestore, 'listName' | 'subtaskCount' | 'detached'>,
): string {
  const list: string = restore.listName;
  const count: number = restore.subtaskCount;
  if (count === 0) {
    return restore.detached
      ? $localize`:@@trash.toast.back-detached:Back in ${list}:list:, detached from its deleted parent.`
      : $localize`:@@trash.toast.back:Back in ${list}:list:.`;
  }
  if (count === 1) {
    return restore.detached
      ? $localize`:@@trash.toast.back-one-detached:With 1 subtask, back in ${list}:list:, detached from its deleted parent.`
      : $localize`:@@trash.toast.back-one:With 1 subtask, back in ${list}:list:.`;
  }
  return restore.detached
    ? $localize`:@@trash.toast.back-many-detached:With ${count}:count: subtasks, back in ${list}:list:, detached from its deleted parent.`
    : $localize`:@@trash.toast.back-many:With ${count}:count: subtasks, back in ${list}:list:.`;
}

/**
 * Function trashRestoreFailed
 *
 * @description
 * The title of the toast when the gateway refuses a restore.
 *
 * @param {string} key - Key of the task.
 * @returns {string} The title.
 */
export function trashRestoreFailed(key: string): string {
  return $localize`:@@trash.toast.restore-failed:Could not restore ${key}:key:`;
}

/**
 * Function trashPurgedTitle
 *
 * @description
 * The title of the purge toast (`CAD-452 erased`, `App.dc.html` line 8416).
 *
 * @param {string} key - Key of the erased task.
 * @returns {string} The title.
 */
export function trashPurgedTitle(key: string): string {
  return $localize`:@@trash.toast.purged:${key}:key: erased`;
}

/**
 * Function trashPurgeFailed
 *
 * @description
 * The title of the toast when the gateway refuses a purge.
 *
 * @param {string} key - Key of the task.
 * @returns {string} The title.
 */
export function trashPurgeFailed(key: string): string {
  return $localize`:@@trash.toast.purge-failed:Could not delete ${key}:key: forever`;
}

/**
 * Function trashGoneTitle
 *
 * @description
 * The title of the toast when a purge finds its entry no longer in the trash (restored or
 * erased meanwhile).
 *
 * @param {string} key - Key of the task.
 * @returns {string} The title.
 */
export function trashGoneTitle(key: string): string {
  return $localize`:@@trash.toast.gone:${key}:key: is no longer in the trash`;
}

/**
 * Function trashEmptiedText
 *
 * @description
 * The description of the toast once the trash is emptied (`12 items erased for good.`).
 *
 * @param {number} count - Entries that left the trash.
 * @returns {string} The description.
 */
export function trashEmptiedText(count: number): string {
  return count === 1
    ? $localize`:@@trash.toast.emptied-one:1 item erased for good.`
    : $localize`:@@trash.toast.emptied-many:${count}:count: items erased for good.`;
}

/**
 * Function trashDaysLeftTitle
 *
 * @description
 * The title of a row's countdown (`Erased for good in 28 days`, `App.dc.html` line 8399).
 *
 * @param {number} days - Days before the entry is erased.
 * @returns {string} The title.
 */
export function trashDaysLeftTitle(days: number): string {
  return days === 1
    ? $localize`:@@trash.row.days-left-title-one:Erased for good in 1 day`
    : $localize`:@@trash.row.days-left-title:Erased for good in ${days}:count: days`;
}

/**
 * Function trashPurgeText
 *
 * @description
 * The description of the `Delete forever` confirmation (`App.dc.html` line 8408).
 *
 * @param {string} name - Name of the task.
 * @returns {string} The description.
 */
export function trashPurgeText(name: string): string {
  return $localize`:@@trash.purge.text:“${name}:name:” will be erased. This action cannot be undone.`;
}

/**
 * Function trashEmptyText
 *
 * @description
 * The description of the `Empty the trash` confirmation (`App.dc.html` line 8406).
 *
 * @param {number} count - Entries shown.
 * @returns {string} The description.
 */
export function trashEmptyText(count: number): string {
  return count === 1
    ? $localize`:@@trash.empty-dialog.text-one:1 item will be erased for good, subtasks and attachments included. This action cannot be undone.`
    : $localize`:@@trash.empty-dialog.text-many:${count}:count: items will be erased for good, subtasks and attachments included. This action cannot be undone.`;
}

/**
 * Function trashRestoreLabel
 *
 * @description
 * The accessible name of a row's `Restore` (`Restore CAD-452`, `App.dc.html` line 8401).
 *
 * @param {string} key - Key of the task.
 * @returns {string} The name.
 */
export function trashRestoreLabel(key: string): string {
  return $localize`:@@trash.row.restore-label:Restore ${key}:key:`;
}

/**
 * Function trashPurgeLabel
 *
 * @description
 * The accessible name and title of a row's purge button (`Delete CAD-452 forever`,
 * `App.dc.html` line 8403).
 *
 * @param {string} key - Key of the task.
 * @returns {string} The name.
 */
export function trashPurgeLabel(key: string): string {
  return $localize`:@@trash.row.purge-label:Delete ${key}:key: forever`;
}

/**
 * Constant TRASH_NOT_READY_TEXT
 *
 * @description
 * The description of the toast when a restore finds its list still being deleted
 * (`409 trash-entry.not-restorable-yet`).
 *
 * @type {string}
 */
export const TRASH_NOT_READY_TEXT: string = $localize`:@@trash.toast.not-ready-text:Its list is still being deleted. Try again in a moment.`;

/**
 * Function trashNotReadyTitle
 *
 * @description
 * The title of the toast when a restore finds its list still being deleted.
 *
 * @param {string} key - Key of the task.
 * @returns {string} The title.
 */
export function trashNotReadyTitle(key: string): string {
  return $localize`:@@trash.toast.not-ready:${key}:key: cannot be restored yet`;
}

/**
 * Function trashCappedText
 *
 * @description
 * The notice under the rows when the trash holds more entries than a read lists.
 *
 * @param {number} shown - Entries listed.
 * @param {number} total - Entries in the trash.
 * @returns {string} The notice.
 */
export function trashCappedText(shown: number, total: number): string {
  return $localize`:@@trash.capped:Showing the ${shown}:shown: most recently deleted items of ${total}:total:. Restore or delete some to see the others.`;
}
