import {
  DOCUMENT,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  EMPTY,
  fromEvent,
  merge,
  type Observable,
  pipe,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { InboxApi } from '../../data-access/services/inbox-api/inbox-api.service';
import type {
  InboxNotification,
  InboxNotificationPage,
} from '../../models/inbox-notification/inbox-notification.interface';
import type {
  InboxReminder,
  InboxReminderPage,
} from '../../models/inbox-reminder/inbox-reminder.interface';

/**
 * Constant POLL_MS
 *
 * @description
 * Interval of the unread badge's polling, in milliseconds. Realtime personal notices would make it
 * unnecessary; the gateway does not push them yet.
 *
 * @type {number}
 */
export const POLL_MS: number = 60_000;

/**
 * Interface InboxState
 *
 * @description
 * The unread badge and how many times the popover opened.
 */
interface InboxState {
  // #region Properties
  /**
   * Property unreadCount
   *
   * @description
   * Unread notifications, or null before the first answer.
   *
   * @type {number | null}
   * @readonly
   */
  readonly unreadCount: number | null;

  /**
   * Property _openings
   *
   * @description
   * Openings of the popover; each one reads the lists again, none is read before the first.
   *
   * @type {number}
   * @readonly
   */
  readonly _openings: number;
  // #endregion
}

/**
 * Interface InboxStoreInstance
 *
 * @description
 * The inbox badge and popover: unread count, notifications, reminders and their writes.
 */
interface InboxStoreInstance {
  // #region Properties
  /**
   * Property unreadCount
   *
   * @description
   * Unread notifications, or null before the first answer.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  readonly unreadCount: Signal<number | null>;

  /**
   * Property notifications
   *
   * @description
   * The newest notifications; idle until the popover opens.
   *
   * @type {ResourceRef<InboxNotificationPage | undefined>}
   * @readonly
   */
  readonly notifications: ResourceRef<InboxNotificationPage | undefined>;

  /**
   * Property reminders
   *
   * @description
   * The pending reminders; idle until the popover opens.
   *
   * @type {ResourceRef<InboxReminderPage | undefined>}
   * @readonly
   */
  readonly reminders: ResourceRef<InboxReminderPage | undefined>;

  /**
   * Property pendingCount
   *
   * @description
   * Pending reminders, or zero before they are read.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly pendingCount: Signal<number>;
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Reads the notifications and the reminders, as the popover opens.
   */
  open(): void;

  /**
   * Method markAllRead
   *
   * @description
   * Shows every notification read at once, then records it; a refusal restores them.
   *
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  markAllRead(): Promise<boolean>;

  /**
   * Method markRead
   *
   * @description
   * Shows a notification read at once, then records it; a refusal restores it.
   *
   * @param {InboxNotification} notification - An unread notification.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  markRead(notification: InboxNotification): Promise<boolean>;

  /**
   * Method snooze
   *
   * @description
   * Moves a reminder to a later instant at once, then records it; a refusal restores it.
   *
   * @param {InboxReminder} reminder - A pending reminder.
   * @param {string} remindAt - New instant, as ISO 8601.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  snooze(reminder: InboxReminder, remindAt: string): Promise<boolean>;

  /**
   * Method complete
   *
   * @description
   * Removes a reminder from the list at once, then marks it done; a refusal restores it.
   *
   * @param {InboxReminder} reminder - A pending reminder.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  complete(reminder: InboxReminder): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No count and no opening yet.
 *
 * @type {InboxState}
 */
const initialState: InboxState = { unreadCount: null, _openings: 0 };

/**
 * Function byDueTime
 *
 * @description
 * Orders reminders as the gateway does: the soonest first.
 *
 * @param {InboxReminder} first - A reminder.
 * @param {InboxReminder} second - Another reminder.
 * @returns {number} Their order.
 */
function byDueTime(first: InboxReminder, second: InboxReminder): number {
  return Date.parse(first.remindAt) - Date.parse(second.remindAt);
}

/**
 * Function createInboxStore
 *
 * @description
 * Creates the inbox store.
 *
 * @returns {Type<InboxStoreInstance>} Injectable store constructor.
 */
function createInboxStore(): Type<InboxStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: InboxApi = inject(InboxApi);
      return {
        _api: api,
        _window: inject(DOCUMENT).defaultView,
        notifications: resource({
          params: (): number | undefined => store._openings() || undefined,
          loader: async (): Promise<InboxNotificationPage> => {
            const page: InboxNotificationPage = await api.notifications();
            patchState(store, { unreadCount: page.unreadCount });
            return page;
          },
        }),
        reminders: resource({
          params: (): number | undefined => store._openings() || undefined,
          loader: (): Promise<InboxReminderPage> => api.pendingReminders(),
        }),
      };
    }),
    withComputed((store) => ({
      pendingCount: (): number =>
        store.reminders.hasValue() ? store.reminders.value().pendingCount : 0,
    })),
    withMethods((store) => {
      // Applies an optimistic change to the notifications, then the write; restores both the page
      // and the count when the write fails.
      const notificationWrite: (
        change: (page: InboxNotificationPage) => InboxNotificationPage,
        write: () => Promise<number | null>,
      ) => Promise<boolean> = async (change, write) => {
        const page: InboxNotificationPage | undefined = store.notifications.hasValue()
          ? store.notifications.value()
          : undefined;
        const count: number | null = store.unreadCount();
        if (page) {
          const changed: InboxNotificationPage = change(page);
          store.notifications.set(changed);
          patchState(store, { unreadCount: changed.unreadCount });
        }
        try {
          const confirmed: number | null = await write();
          if (confirmed !== null) patchState(store, { unreadCount: confirmed });
          return true;
        } catch {
          if (page) store.notifications.set(page);
          patchState(store, { unreadCount: count });
          return false;
        }
      };

      // Applies an optimistic change to the reminders, then the write; restores the page when the
      // write fails.
      const reminderWrite: (
        change: (page: InboxReminderPage) => InboxReminderPage,
        write: () => Promise<unknown>,
      ) => Promise<boolean> = async (change, write) => {
        if (!store.reminders.hasValue()) return false;
        const page: InboxReminderPage = store.reminders.value();
        store.reminders.set(change(page));
        try {
          await write();
          return true;
        } catch {
          store.reminders.set(page);
          return false;
        }
      };

      return {
        _watchUnread: rxMethod<unknown>(
          pipe(
            switchMap(() => store._api.unreadCount().pipe(catchError(() => EMPTY))),
            tap((unreadCount: number) => {
              patchState(store, { unreadCount });
            }),
          ),
        ),
        open(): void {
          patchState(store, { _openings: store._openings() + 1 });
        },
        markAllRead(): Promise<boolean> {
          return notificationWrite(
            (page: InboxNotificationPage) => ({
              unreadCount: 0,
              items: page.items.map((item: InboxNotification) => ({ ...item, read: true })),
            }),
            () => store._api.markAllRead(),
          );
        },
        markRead(notification: InboxNotification): Promise<boolean> {
          if (notification.read) return Promise.resolve(true);
          return notificationWrite(
            (page: InboxNotificationPage) => ({
              unreadCount: Math.max(0, page.unreadCount - 1),
              items: page.items.map((item: InboxNotification) =>
                item.id === notification.id ? { ...item, read: true } : item,
              ),
            }),
            async (): Promise<null> => {
              await store._api.markRead(notification.id);
              return null;
            },
          );
        },
        snooze(reminder: InboxReminder, remindAt: string): Promise<boolean> {
          return reminderWrite(
            (page: InboxReminderPage) => ({
              ...page,
              items: page.items
                .map((item: InboxReminder) =>
                  item.id === reminder.id ? { ...item, remindAt } : item,
                )
                .sort(byDueTime),
            }),
            () => store._api.snooze(reminder.id, remindAt),
          );
        },
        complete(reminder: InboxReminder): Promise<boolean> {
          return reminderWrite(
            (page: InboxReminderPage) => ({
              items: page.items.filter((item: InboxReminder) => item.id !== reminder.id),
              pendingCount: Math.max(0, page.pendingCount - 1),
            }),
            () => store._api.complete(reminder.id),
          );
        },
      };
    }),
    withHooks({
      onInit(store): void {
        const triggers: Observable<unknown>[] = [timer(0, POLL_MS)];
        if (store._window) triggers.push(fromEvent(store._window, 'focus'));
        store._watchUnread(merge(...triggers));
      },
    }),
  );
}

/**
 * Constant InboxStore
 *
 * @description
 * The inbox of the rail, provided by its rail item so it lives with the shell. The unread count is
 * read at once, every 60 seconds and when the window regains focus; the notifications and the
 * reminders are read each time the popover opens. Writes are optimistic and restored on refusal;
 * a failed read keeps its resource error for the popover's inline « Réessayer ».
 *
 * @type {ReturnType<typeof createInboxStore>}
 */
export const InboxStore: ReturnType<typeof createInboxStore> = createInboxStore();
