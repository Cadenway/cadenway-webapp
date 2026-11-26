import type { CwStatusKey } from '@cadenway/ui/components/status-icon';

/**
 * Constant KIND_ICONS
 *
 * @description
 * Icon of each notification category, from the mockup's inbox rows; a category without one shows
 * the bell.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const KIND_ICONS: Readonly<Record<string, string>> = {
  mention: 'phosphorAtBold',
  'status-change': 'phosphorArrowsClockwiseBold',
  assignment: 'phosphorUserPlusBold',
  comment: 'phosphorChatCircleBold',
  approval: 'phosphorSealCheckBold',
};

/**
 * Constant STATUS_WORDS
 *
 * @description
 * Words of the workflow statuses, for `moved the task to Blocked`.
 *
 * @type {Readonly<Record<CwStatusKey, string>>}
 */
export const STATUS_WORDS: Readonly<Record<CwStatusKey, string>> = {
  triage: $localize`:@@inbox.status.triage:To triage`,
  backlog: $localize`:@@inbox.status.backlog:To plan`,
  todo: $localize`:@@inbox.status.todo:To do`,
  progress: $localize`:@@inbox.status.progress:In progress`,
  review: $localize`:@@inbox.status.review:In review`,
  testing: $localize`:@@inbox.status.testing:In validation`,
  waiting: $localize`:@@inbox.status.waiting:Waiting`,
  blocked: $localize`:@@inbox.status.blocked:Blocked`,
  done: $localize`:@@inbox.status.done:Done`,
  cancelled: $localize`:@@inbox.status.cancelled:Cancelled`,
};

/**
 * Function notificationVerb
 *
 * @description
 * What the actor did, written after their name as in the mockup (`mentioned you`). A
 * category the mockup does not draw reads as a generic notification.
 *
 * @param {string} kind - Notification category.
 * @param {CwStatusKey | null} status - Status a `status-change` moved the task to.
 * @returns {string} The verb phrase.
 */
export function notificationVerb(kind: string, status: CwStatusKey | null): string {
  switch (kind) {
    case 'mention':
      return $localize`:@@inbox.verb.mention:mentioned you`;
    case 'assignment':
      return $localize`:@@inbox.verb.assignment:assigned you a task`;
    case 'comment':
      return $localize`:@@inbox.verb.comment:commented`;
    case 'approval':
      return $localize`:@@inbox.verb.approval:asks you to approve`;
    case 'status-change':
      return status
        ? $localize`:@@inbox.verb.status-change:moved the task to ${STATUS_WORDS[status]}:status:`
        : $localize`:@@inbox.verb.status-changed:changed the task’s status`;
    default:
      return $localize`:@@inbox.verb.other:sent you a notification`;
  }
}
