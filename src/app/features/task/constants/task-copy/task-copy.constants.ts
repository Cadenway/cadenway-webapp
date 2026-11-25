import type {
  CancelReason,
  MilestoneStatusKey,
  PriorityKey,
  Recurrence,
  StatusCategory,
  StatusKey,
} from '@cadenway/contracts';

/**
 * Constant STATUS_LABELS
 *
 * @description
 * Default word of each status, used when a space does not rename it (`STATUSES` of
 * `App.dc.html`).
 *
 * @type {Readonly<Record<StatusKey, string>>}
 */
export const STATUS_LABELS: Readonly<Record<StatusKey, string>> = {
  triage: $localize`:@@task.status.triage:To sort`,
  backlog: $localize`:@@task.status.backlog:To plan`,
  todo: $localize`:@@task.status.todo:To do`,
  progress: $localize`:@@task.status.progress:In progress`,
  review: $localize`:@@task.status.review:In review`,
  testing: $localize`:@@task.status.testing:In validation`,
  waiting: $localize`:@@task.status.waiting:Waiting`,
  blocked: $localize`:@@task.status.blocked:Blocked`,
  done: $localize`:@@task.status.done:Done`,
  cancelled: $localize`:@@task.status.cancelled:Cancelled`,
};

/**
 * Constant STATUS_HINTS
 *
 * @description
 * One-line meaning of each status, shown under its word in the status menus.
 *
 * @type {Readonly<Record<StatusKey, string>>}
 */
export const STATUS_HINTS: Readonly<Record<StatusKey, string>> = {
  triage: $localize`:@@task.status.triage-hint:Request received, not qualified yet`,
  backlog: $localize`:@@task.status.backlog-hint:Kept, without a work date`,
  todo: $localize`:@@task.status.todo-hint:Ready to start`,
  progress: $localize`:@@task.status.progress-hint:Someone is working on it`,
  review: $localize`:@@task.status.review-hint:Reviewed by a peer`,
  testing: $localize`:@@task.status.testing-hint:Checked by the requester`,
  waiting: $localize`:@@task.status.waiting-hint:Waits for an outside answer`,
  blocked: $localize`:@@task.status.blocked-hint:An obstacle prevents progress`,
  done: $localize`:@@task.status.done-hint:Delivered and validated`,
  cancelled: $localize`:@@task.status.cancelled-hint:Will not be done`,
};

/**
 * Constant STATUS_CATEGORY_LABELS
 *
 * @description
 * Headings of the status menus, one per category (`STATUS_CATS` of `App.dc.html`).
 *
 * @type {Readonly<Record<StatusCategory, string>>}
 */
export const STATUS_CATEGORY_LABELS: Readonly<Record<StatusCategory, string>> = {
  open: $localize`:@@task.status.category-open:Not started`,
  active: $localize`:@@task.status.category-active:Active`,
  closed: $localize`:@@task.status.category-closed:Closed`,
};

/**
 * Constant MILESTONE_STATUS_LABELS
 *
 * @description
 * Words of the four statuses of a milestone (`MS_STATUS` of `App.dc.html`).
 *
 * @type {Readonly<Record<MilestoneStatusKey, string>>}
 */
export const MILESTONE_STATUS_LABELS: Readonly<Record<MilestoneStatusKey, string>> = {
  todo: $localize`:@@task.milestone.todo:Upcoming`,
  blocked: $localize`:@@task.milestone.blocked:At risk`,
  done: $localize`:@@task.milestone.done:Reached`,
  cancelled: $localize`:@@task.milestone.cancelled:Cancelled`,
};

/**
 * Constant MILESTONE_STATUS_HINTS
 *
 * @description
 * One-line meaning of each milestone status.
 *
 * @type {Readonly<Record<MilestoneStatusKey, string>>}
 */
export const MILESTONE_STATUS_HINTS: Readonly<Record<MilestoneStatusKey, string>> = {
  todo: $localize`:@@task.milestone.todo-hint:The date has not passed yet`,
  blocked: $localize`:@@task.milestone.blocked-hint:A dependency threatens the date`,
  done: $localize`:@@task.milestone.done-hint:The due date is kept`,
  cancelled: $localize`:@@task.milestone.cancelled-hint:The milestone is dropped`,
};

/**
 * Constant PRIORITY_LABELS
 *
 * @description
 * Word of each priority (`PRIORITIES` of `App.dc.html`).
 *
 * @type {Readonly<Record<PriorityKey, string>>}
 */
export const PRIORITY_LABELS: Readonly<Record<PriorityKey, string>> = {
  urgente: $localize`:@@task.priority.urgente:Urgent`,
  haute: $localize`:@@task.priority.haute:High`,
  moyenne: $localize`:@@task.priority.moyenne:Medium`,
  basse: $localize`:@@task.priority.basse:Low`,
};

/**
 * Constant CANCEL_REASON_LABELS
 *
 * @description
 * Word of each cancel reason (`CANCEL_REASONS` of `App.dc.html`).
 *
 * @type {Readonly<Record<CancelReason, string>>}
 */
export const CANCEL_REASON_LABELS: Readonly<Record<CancelReason, string>> = {
  duplicate: $localize`:@@task.cancel.duplicate:Duplicate`,
  wontdo: $localize`:@@task.cancel.wontdo:Will not be done`,
  scope: $localize`:@@task.cancel.scope:Out of scope`,
  obsolete: $localize`:@@task.cancel.obsolete:Obsolete`,
};

/**
 * Constant CANCEL_REASON_HINTS
 *
 * @description
 * One-line meaning of each cancel reason.
 *
 * @type {Readonly<Record<CancelReason, string>>}
 */
export const CANCEL_REASON_HINTS: Readonly<Record<CancelReason, string>> = {
  duplicate: $localize`:@@task.cancel.duplicate-hint:Another task already covers this need`,
  wontdo: $localize`:@@task.cancel.wontdo-hint:Decision not to handle the request`,
  scope: $localize`:@@task.cancel.scope-hint:Not for this team or this project`,
  obsolete: $localize`:@@task.cancel.obsolete-hint:The need is gone or has changed`,
};

/**
 * Constant CANCEL_REASON_ICONS
 *
 * @description
 * Phosphor icon of each cancel reason.
 *
 * @type {Readonly<Record<CancelReason, string>>}
 */
export const CANCEL_REASON_ICONS: Readonly<Record<CancelReason, string>> = {
  duplicate: 'phosphorCopyBold',
  wontdo: 'phosphorProhibitBold',
  scope: 'phosphorArrowsOutBold',
  obsolete: 'phosphorClockCounterClockwiseBold',
};

/**
 * Constant RECURRENCE_TITLES
 *
 * @description
 * Tooltip of the repeat icon of a recurring task (`Repeats: every week`); `none` has
 * no icon.
 *
 * @type {Readonly<Record<Recurrence, string>>}
 */
export const RECURRENCE_TITLES: Readonly<Record<Recurrence, string>> = {
  none: '',
  daily: $localize`:@@task.recurrence.daily:Repeats: every working day`,
  weekly: $localize`:@@task.recurrence.weekly:Repeats: every week`,
  biweekly: $localize`:@@task.recurrence.biweekly:Repeats: every 2 weeks`,
  monthly: $localize`:@@task.recurrence.monthly:Repeats: every month`,
};
