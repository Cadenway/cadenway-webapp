import { inject, Service } from '@angular/core';
import {
  type InboxPage,
  type InboxReadAllResult,
  InboxService,
  type InboxUnreadCount,
  type Reminder,
  type ReminderPage,
  RemindersService,
} from '@cadenway/api-client';
import { firstValueFrom, map, type Observable } from 'rxjs';

import type { InboxNotificationPage } from '../../../models/inbox-notification/inbox-notification.interface';
import type {
  InboxReminder,
  InboxReminderPage,
} from '../../../models/inbox-reminder/inbox-reminder.interface';
import {
  toInboxNotificationPage,
  toInboxReminder,
  toInboxReminderPage,
} from '../../adapters/inbox/inbox.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Notifications and reminders the popover lists; the rest belong to the home screen.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 30;

/**
 * Service InboxApi
 *
 * @description
 * The inbox popover's access to `inbox` and `reminders` of the gateway, mapped to display models.
 * Every operation needs the session's current organization.
 */
@Service()
export class InboxApi {
  // #region Properties
  /**
   * Property inbox
   *
   * @description
   * Generated inbox operations.
   *
   * @type {InboxService}
   * @readonly
   */
  private readonly inbox: InboxService = inject(InboxService);

  /**
   * Property reminders
   *
   * @description
   * Generated reminder operations.
   *
   * @type {RemindersService}
   * @readonly
   */
  private readonly reminders: RemindersService = inject(RemindersService);
  // #endregion

  // #region Methods
  /**
   * Method unreadCount
   *
   * @description
   * Reads the badge: unread notifications, bypassing the HTTP cache.
   *
   * @returns {Observable<number>} The count.
   */
  public unreadCount(): Observable<number> {
    return this.inbox
      .getInboxUnreadCount({ cache: 'no-store' })
      .pipe(map((count: InboxUnreadCount) => count.unreadCount));
  }

  /**
   * Method notifications
   *
   * @description
   * Reads the newest active notifications, read and unread.
   *
   * @returns {Promise<InboxNotificationPage>} The page and the unread count.
   */
  public async notifications(): Promise<InboxNotificationPage> {
    const page: InboxPage = await firstValueFrom(
      this.inbox.listInboxNotifications({ limit: PAGE_SIZE, state: 'active' }),
    );
    return toInboxNotificationPage(page);
  }

  /**
   * Method markAllRead
   *
   * @description
   * Marks every unread notification read; later ones stay unread.
   *
   * @returns {Promise<number>} The unread count left.
   */
  public async markAllRead(): Promise<number> {
    const result: InboxReadAllResult = await firstValueFrom(
      this.inbox.markInboxNotificationsRead(),
    );
    return result.unreadCount;
  }

  /**
   * Method markRead
   *
   * @description
   * Marks one notification read; repeating it is not an error.
   *
   * @param {string} notificationId - The notification.
   * @returns {Promise<void>} Resolves once recorded.
   */
  public async markRead(notificationId: string): Promise<void> {
    await firstValueFrom(this.inbox.markInboxNotificationRead(notificationId));
  }

  /**
   * Method pendingReminders
   *
   * @description
   * Reads the pending reminders, overdue ones included, the soonest first.
   *
   * @returns {Promise<InboxReminderPage>} The page and the pending count.
   */
  public async pendingReminders(): Promise<InboxReminderPage> {
    const page: ReminderPage = await firstValueFrom(
      this.reminders.listReminders({ limit: PAGE_SIZE }),
    );
    return toInboxReminderPage(page);
  }

  /**
   * Method reminder
   *
   * @description
   * Revalidates a due reminder against the current session before it is displayed.
   *
   * @param {string} reminderId - Reminder identifier.
   * @returns {Promise<InboxReminder>} The current reminder.
   */
  public async reminder(reminderId: string): Promise<InboxReminder> {
    return toInboxReminder(
      await firstValueFrom(this.reminders.getReminder(reminderId, { cache: 'no-store' })),
    );
  }

  /**
   * Method snooze
   *
   * @description
   * Postpones a pending reminder, keeping its note.
   *
   * @param {string} reminderId - The reminder.
   * @param {string} remindAt - New instant, in the future, as ISO 8601.
   * @returns {Promise<InboxReminder>} The rescheduled reminder.
   */
  public async snooze(reminderId: string, remindAt: string): Promise<InboxReminder> {
    const reminder: Reminder = await firstValueFrom(
      this.reminders.snoozeReminder(reminderId, { remindAt }),
    );
    return toInboxReminder(reminder);
  }

  /**
   * Method complete
   *
   * @description
   * Marks a reminder done; it leaves the pending list.
   *
   * @param {string} reminderId - The reminder.
   * @returns {Promise<void>} Resolves once recorded.
   */
  public async complete(reminderId: string): Promise<void> {
    await firstValueFrom(this.reminders.completeReminder(reminderId));
  }
  // #endregion
}
