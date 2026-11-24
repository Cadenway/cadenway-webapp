import { TestBed } from '@angular/core/testing';
import { type Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { InboxApi } from '../../data-access/services/inbox-api/inbox-api.service';
import type {
  InboxNotification,
  InboxNotificationPage,
} from '../../models/inbox-notification/inbox-notification.interface';
import type {
  InboxReminder,
  InboxReminderPage,
} from '../../models/inbox-reminder/inbox-reminder.interface';
import { InboxStore, POLL_MS } from './inbox.store';

/**
 * Constant mention
 *
 * @description
 * Inès Robert's unread mention on CAD-482, from the mockup.
 *
 * @type {InboxNotification}
 */
const mention: InboxNotification = {
  id: 'n1',
  kind: 'mention',
  actorName: 'Inès Robert',
  actorInitials: 'IR',
  taskKey: 'CAD-482',
  taskName: 'Relecture du parcours SSO',
  excerpt: '@Camille tu peux relire le parcours SSO avant la démo de jeudi ?',
  status: null,
  createdAt: '2026-11-08T09:48:00Z',
  read: false,
};

/**
 * Constant reminders
 *
 * @description
 * Two pending reminders of the mockup.
 *
 * @type {InboxReminderPage}
 */
const reminders: InboxReminderPage = {
  items: [
    {
      id: 'r0',
      taskKey: 'CAD-479',
      taskName: 'Prévenir le support',
      remindAt: '2026-11-08T08:00:00Z',
      note: 'Prévenir le support avant la mise en production',
    },
    {
      id: 'r1',
      taskKey: 'CAD-488',
      taskName: 'Maquettes',
      remindAt: '2026-11-08T14:00:00Z',
      note: null,
    },
  ],
  pendingCount: 2,
};

/**
 * Function reminderAt
 *
 * @description
 * A reminder of the fixture by position.
 *
 * @param {number} index - Position in `reminders`.
 * @returns {InboxReminder} The reminder.
 * @throws {Error} When the fixture has no such reminder.
 */
function reminderAt(index: number): InboxReminder {
  const reminder: InboxReminder | undefined = reminders.items.at(index);
  if (reminder === undefined) throw new Error('No reminder');
  return reminder;
}

/**
 * Interface InboxApiFake
 *
 * @description
 * Fake of the inbox data-access service.
 */
interface InboxApiFake {
  // #region Properties
  /**
   * Property unreadCount
   *
   * @description
   * Fake of `unreadCount`.
   *
   * @type {Mock<() => Observable<number>>}
   * @readonly
   */
  readonly unreadCount: Mock<() => Observable<number>>;

  /**
   * Property notifications
   *
   * @description
   * Fake of `notifications`.
   *
   * @type {Mock<() => Promise<InboxNotificationPage>>}
   * @readonly
   */
  readonly notifications: Mock<() => Promise<InboxNotificationPage>>;

  /**
   * Property pendingReminders
   *
   * @description
   * Fake of `pendingReminders`.
   *
   * @type {Mock<() => Promise<InboxReminderPage>>}
   * @readonly
   */
  readonly pendingReminders: Mock<() => Promise<InboxReminderPage>>;

  /**
   * Property markAllRead
   *
   * @description
   * Fake of `markAllRead`.
   *
   * @type {Mock<() => Promise<number>>}
   * @readonly
   */
  readonly markAllRead: Mock<() => Promise<number>>;

  /**
   * Property markRead
   *
   * @description
   * Fake of `markRead`.
   *
   * @type {Mock<(id: string) => Promise<void>>}
   * @readonly
   */
  readonly markRead: Mock<(id: string) => Promise<void>>;

  /**
   * Property snooze
   *
   * @description
   * Fake of `snooze`.
   *
   * @type {Mock<(id: string, remindAt: string) => Promise<unknown>>}
   * @readonly
   */
  readonly snooze: Mock<(id: string, remindAt: string) => Promise<unknown>>;

  /**
   * Property complete
   *
   * @description
   * Fake of `complete`.
   *
   * @type {Mock<(id: string) => Promise<void>>}
   * @readonly
   */
  readonly complete: Mock<(id: string) => Promise<void>>;
  // #endregion
}

describe('InboxStore', () => {
  let api: InboxApiFake;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      unreadCount: vi.fn(() => of(1)),
      notifications: vi.fn(() => Promise.resolve({ items: [mention], unreadCount: 1 })),
      pendingReminders: vi.fn(() => Promise.resolve(reminders)),
      markAllRead: vi.fn(() => Promise.resolve(0)),
      markRead: vi.fn(() => Promise.resolve()),
      snooze: vi.fn(() => Promise.resolve({})),
      complete: vi.fn(() => Promise.resolve()),
    };
    TestBed.configureTestingModule({
      providers: [InboxStore, { provide: InboxApi, useValue: api }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function opened
   *
   * @description
   * Creates the store and opens the popover, waiting for both lists.
   *
   * @returns {Promise<InstanceType<typeof InboxStore>>} The store.
   */
  async function opened(): Promise<InstanceType<typeof InboxStore>> {
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    store.open();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.reminders.hasValue() && store.notifications.hasValue()).toBe(true);
    });
    return store;
  }

  it('polls the unread count at once, every minute and when the window regains focus', async () => {
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.unreadCount()).toBe(1);

    api.unreadCount.mockReturnValue(of(3));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.unreadCount()).toBe(3);

    api.unreadCount.mockReturnValue(of(4));
    window.dispatchEvent(new Event('focus'));
    expect(store.unreadCount()).toBe(4);
    expect(api.unreadCount).toHaveBeenCalledTimes(3);
  });

  it('keeps the last count when a poll fails', async () => {
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    await vi.advanceTimersByTimeAsync(0);
    api.unreadCount.mockReturnValue(throwError(() => new Error('unavailable')));
    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(store.unreadCount()).toBe(1);
  });

  it('reads nothing until the popover opens, then both lists', async () => {
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    TestBed.tick();
    expect(api.notifications).not.toHaveBeenCalled();

    await opened();

    expect(store.pendingCount()).toBe(2);
    expect(api.notifications).toHaveBeenCalledOnce();
  });

  it('marks everything read at once and keeps it when the gateway agrees', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();

    const done: Promise<boolean> = store.markAllRead();
    expect(store.unreadCount()).toBe(0);
    expect(store.notifications.value()?.items.every((item) => item.read)).toBe(true);
    await expect(done).resolves.toBe(true);
  });

  it('restores the unread notifications when marking them read is refused', async () => {
    api.markAllRead.mockRejectedValueOnce(new Error('unavailable'));
    const store: InstanceType<typeof InboxStore> = await opened();

    await expect(store.markAllRead()).resolves.toBe(false);

    expect(store.unreadCount()).toBe(1);
    expect(store.notifications.value()?.items[0]?.read).toBe(false);
  });

  it('marks one notification read', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();

    await expect(store.markRead(mention)).resolves.toBe(true);

    expect(api.markRead).toHaveBeenCalledWith('n1');
    expect(store.unreadCount()).toBe(0);
  });

  it('removes a completed reminder, and puts it back when refused', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();
    const late: InboxReminder = reminderAt(0);

    await expect(store.complete(late)).resolves.toBe(true);
    expect(store.reminders.value()?.items.map((item) => item.id)).toEqual(['r1']);
    expect(store.pendingCount()).toBe(1);

    api.complete.mockRejectedValueOnce(new Error('unavailable'));
    await expect(store.complete(reminderAt(1))).resolves.toBe(false);
    expect(store.reminders.value()?.items.map((item) => item.id)).toEqual(['r1']);
  });

  it('moves a snoozed reminder to its new time and order', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();
    const late: InboxReminder = reminderAt(0);

    await expect(store.snooze(late, '2026-11-09T08:00:00Z')).resolves.toBe(true);

    expect(api.snooze).toHaveBeenCalledWith('r0', '2026-11-09T08:00:00Z');
    expect(store.reminders.value()?.items.map((item) => item.id)).toEqual(['r1', 'r0']);
  });
});
