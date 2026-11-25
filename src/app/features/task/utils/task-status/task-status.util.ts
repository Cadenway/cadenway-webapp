import {
  MILESTONE_STATUS_KEYS,
  type MilestoneStatusKey,
  STATUS_CATEGORY_BY_KEY,
  STATUS_KEYS,
  type StatusKey,
} from '@cadenway/contracts';

import {
  MILESTONE_STATUS_LABELS,
  STATUS_LABELS,
} from '../../constants/task-copy/task-copy.constants';
import type { StatusOption } from '../../models/status-option/status-option.interface';

/**
 * Constant NEXT_STATUS
 *
 * @description
 * Status the main part of the status split button moves a task to (`NEXT_STATUS` of
 * `App.dc.html`). À planifier, En attente, Bloqué and Annulé are only chosen by hand, and a
 * closed task has no next status.
 *
 * @type {Readonly<Partial<Record<StatusKey, StatusKey>>>}
 */
const NEXT_STATUS: Readonly<Partial<Record<StatusKey, StatusKey>>> = {
  triage: 'todo',
  backlog: 'todo',
  todo: 'progress',
  progress: 'review',
  review: 'testing',
  testing: 'done',
  waiting: 'progress',
  blocked: 'progress',
};

/**
 * Function isMilestoneStatus
 *
 * @description
 * Tells whether a milestone can take a status.
 *
 * @param {StatusKey} status - Status to check.
 * @returns {boolean} Whether the status is one of `MILESTONE_STATUS_KEYS`.
 */
export function isMilestoneStatus(status: StatusKey): status is MilestoneStatusKey {
  return (MILESTONE_STATUS_KEYS as readonly StatusKey[]).includes(status);
}

/**
 * Function nextStatus
 *
 * @description
 * The status one click on the main part of the split button gives: `NEXT_STATUS` for a task, and
 * « Atteint » for an upcoming or at-risk milestone (`App.dc.html` near line 5358).
 *
 * @param {StatusKey} status - Status shown now.
 * @param {boolean} milestone - Whether the task is a milestone.
 * @returns {StatusKey | null} The next status, or null when the split button opens its menu.
 */
export function nextStatus(status: StatusKey, milestone: boolean): StatusKey | null {
  if (milestone) return status === 'todo' || status === 'blocked' ? 'done' : null;
  return NEXT_STATUS[status] ?? null;
}

/**
 * Function isClosedStatus
 *
 * @description
 * Tells whether a status belongs to the closed category: a closed task is never late.
 *
 * @param {StatusKey} status - Status to check.
 * @returns {boolean} Whether the status is `done` or `cancelled`.
 */
export function isClosedStatus(status: StatusKey): boolean {
  return STATUS_CATEGORY_BY_KEY[status] === 'closed';
}

/**
 * Function defaultStatusOptions
 *
 * @description
 * The ten statuses with their default words, none hidden, for a task whose space statuses are not
 * known.
 *
 * @returns {readonly StatusOption[]} The options in workflow order.
 */
export function defaultStatusOptions(): readonly StatusOption[] {
  return STATUS_KEYS.map((key: StatusKey): StatusOption => ({
    key,
    label: STATUS_LABELS[key],
    category: STATUS_CATEGORY_BY_KEY[key],
    hidden: false,
    milestone: isMilestoneStatus(key),
  }));
}

/**
 * Function statusLabel
 *
 * @description
 * The word a status shows: the milestone word for a milestone, else the space's name for it,
 * else the default word.
 *
 * @param {StatusKey} status - Status to name.
 * @param {readonly StatusOption[]} options - Statuses of the task's space; may be empty.
 * @param {boolean} milestone - Whether the task is a milestone.
 * @returns {string} The word.
 */
export function statusLabel(
  status: StatusKey,
  options: readonly StatusOption[],
  milestone: boolean,
): string {
  if (milestone && isMilestoneStatus(status)) return MILESTONE_STATUS_LABELS[status];
  return (
    options.find((option: StatusOption) => option.key === status)?.label ?? STATUS_LABELS[status]
  );
}

/**
 * Function pickableStatuses
 *
 * @description
 * The statuses a menu offers (`statusOpts` and `msOpts` of `App.dc.html`): the space's visible
 * statuses plus the current one even when hidden; for a milestone, its four statuses with their
 * milestone words.
 *
 * @param {readonly StatusOption[]} options - Statuses of the space; the defaults when empty.
 * @param {StatusKey} current - Status shown now.
 * @param {boolean} milestone - Whether the task is a milestone.
 * @returns {readonly StatusOption[]} The options in workflow order.
 */
export function pickableStatuses(
  options: readonly StatusOption[],
  current: StatusKey,
  milestone: boolean,
): readonly StatusOption[] {
  const all: readonly StatusOption[] = options.length > 0 ? options : defaultStatusOptions();
  if (milestone) {
    return all
      .filter((option: StatusOption) => isMilestoneStatus(option.key))
      .map((option: StatusOption): StatusOption => ({
        ...option,
        label: MILESTONE_STATUS_LABELS[option.key as MilestoneStatusKey],
      }));
  }
  return all.filter((option: StatusOption) => !option.hidden || option.key === current);
}
