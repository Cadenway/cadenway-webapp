import type {
  InboxNotification as InboxNotificationDto,
  InboxPage,
  Reminder,
  ReminderPage,
} from '@cadenway/api-client';

import type {
  InboxNotification,
  InboxNotificationPage,
} from '../../../models/inbox-notification/inbox-notification.interface';
import type {
  InboxReminder,
  InboxReminderPage,
} from '../../../models/inbox-reminder/inbox-reminder.interface';

/**
 * Function initialsOf
 *
 * @description
 * The first letters of the first and last words of a name (`Camille Martin` gives `CM`), or the
 * first two letters of a single word.
 *
 * @param {string} name - Full name.
 * @returns {string} One or two uppercase letters, or an empty string for a blank name.
 */
export function initialsOf(name: string): string {
  const words: string[] = name.trim().split(/\s+/u).filter(Boolean);
  const first: string = words.at(0) ?? '';
  const last: string = words.length > 1 ? (words.at(-1) ?? '') : '';
  const letters: string = last
    ? `${Array.from(first)[0] ?? ''}${Array.from(last)[0] ?? ''}`
    : Array.from(first).slice(0, 2).join('');
  return letters.toLocaleUpperCase();
}

/**
 * Function toInboxNotification
 *
 * @description
 * Keeps the fields of a notification the popover shows; an archived one never reaches it.
 *
 * @param {InboxNotificationDto} notification - Item of `GET /v1/inbox/notifications`.
 * @returns {InboxNotification} Display model of the notification.
 */
export function toInboxNotification(notification: InboxNotificationDto): InboxNotification {
  return {
    id: notification.id,
    kind: notification.kind,
    actorName: notification.actor?.name ?? null,
    actorInitials: notification.actor ? initialsOf(notification.actor.name) : '',
    taskKey: notification.task?.taskKey ?? null,
    taskName: notification.task?.name ?? null,
    excerpt: notification.excerpt,
    status: notification.status,
    createdAt: notification.createdAt,
    read: notification.readAt !== null,
  };
}

/**
 * Function toInboxNotificationPage
 *
 * @description
 * Maps a notification page and its unread count.
 *
 * @param {InboxPage} page - `GET /v1/inbox/notifications` answer.
 * @returns {InboxNotificationPage} Display model of the page.
 */
export function toInboxNotificationPage(page: InboxPage): InboxNotificationPage {
  return {
    items: page.items.map((notification: InboxNotificationDto) =>
      toInboxNotification(notification),
    ),
    unreadCount: page.unreadCount,
  };
}

/**
 * Function toInboxReminder
 *
 * @description
 * Keeps the fields of a pending reminder the `Reminders` tab shows.
 *
 * @param {Reminder} reminder - A reminder of `GET /v1/reminders`.
 * @returns {InboxReminder} Display model of the reminder.
 */
export function toInboxReminder(reminder: Reminder): InboxReminder {
  return {
    id: reminder.id,
    taskKey: reminder.taskKey,
    taskName: reminder.taskName,
    remindAt: reminder.remindAt,
    note: reminder.note,
  };
}

/**
 * Function toInboxReminderPage
 *
 * @description
 * Maps a reminder page and its pending count.
 *
 * @param {ReminderPage} page - `GET /v1/reminders` answer.
 * @returns {InboxReminderPage} Display model of the page.
 */
export function toInboxReminderPage(page: ReminderPage): InboxReminderPage {
  return {
    items: page.items.map((reminder: Reminder) => toInboxReminder(reminder)),
    pendingCount: page.pendingCount,
  };
}
