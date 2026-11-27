import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, of, Subject, throwError } from 'rxjs';

import { RealtimeConnection, type PersonalNotice } from '@core/realtime';
import {
  OrganizationPin,
  OrganizationSwitchPendingError,
  organizationPinInterceptor,
  PASSIVE_REQUEST,
} from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { InboxApi } from '../../data-access/services/inbox-api/inbox-api.service';
import type {
  InboxNotification,
  InboxNotificationPage,
} from '../../models/inbox-notification/inbox-notification.interface';
import type { InboxRead } from '../../models/inbox-read/inbox-read.interface';
import type {
  InboxReminder,
  InboxReminderPage,
} from '../../models/inbox-reminder/inbox-reminder.interface';
import { InboxReads } from '../../services/inbox-reads/inbox-reads.service';
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
  taskName: 'Review of the SSO flow',
  excerpt: '@Camille can you review the SSO flow before the Thursday demo?',
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
      taskName: 'Notify the support team',
      remindAt: '2026-11-08T08:00:00Z',
      note: 'Notify the support team before the release',
    },
    {
      id: 'r1',
      taskKey: 'CAD-488',
      taskName: 'Mockups',
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
 * Constant other
 *
 * @description
 * A second unread notification, a comment on CAD-475.
 *
 * @type {InboxNotification}
 */
const other: InboxNotification = {
  ...mention,
  id: 'n2',
  kind: 'comment',
  taskKey: 'CAD-475',
  excerpt: null,
};

/**
 * Interface Deferred
 *
 * @description
 * A promise settled by the test, to order overlapping writes.
 *
 * @template T
 */
interface Deferred<T> {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The pending promise.
   *
   * @type {Promise<T>}
   * @readonly
   */
  readonly promise: Promise<T>;

  /**
   * Property resolve
   *
   * @description
   * Fulfils the promise.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;

  /**
   * Property reject
   *
   * @description
   * Rejects the promise.
   *
   * @type {(error: Error) => void}
   * @readonly
   */
  readonly reject: (error: Error) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * Creates a promise the test settles.
 *
 * @template T
 * @returns {Deferred<T>} The promise and its settlers.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = (): void => undefined;
  let reject: (error: Error) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>(
    (done: (value: T) => void, fail: (error: Error) => void) => {
      resolve = done;
      reject = fail;
    },
  );
  return { promise, resolve, reject };
}

/**
 * Function workspaceOrganization
 *
 * @description
 * An organization as the workspace port shows it.
 *
 * @param {string} id - Organization id.
 * @returns {WorkspaceOrganization} The organization.
 */
function workspaceOrganization(id: string): WorkspaceOrganization {
  return { id, slug: id, name: id, initials: 'AN', role: 'owner', plan: 'team' };
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
   * Property reminder
   *
   * @description
   * Fake of the single-reminder read.
   *
   * @type {Mock<(id: string) => Promise<InboxReminder>>}
   * @readonly
   */
  readonly reminder: Mock<(id: string) => Promise<InboxReminder>>;

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
  let current: WritableSignal<WorkspaceOrganization>;
  let notices: Subject<PersonalNotice>;
  let reconnects: Subject<void>;
  let connectionStatus: WritableSignal<'connected' | 'connecting' | 'reconnecting' | 'disabled'>;

  beforeEach(() => {
    vi.useFakeTimers();
    notices = new Subject<PersonalNotice>();
    reconnects = new Subject<void>();
    connectionStatus = signal<'connected' | 'connecting' | 'reconnecting' | 'disabled'>(
      'connected',
    );
    api = {
      unreadCount: vi.fn(() => of(1)),
      notifications: vi.fn(() => Promise.resolve({ items: [mention], unreadCount: 1 })),
      pendingReminders: vi.fn(() => Promise.resolve(reminders)),
      reminder: vi.fn(() => Promise.resolve(reminders.items[0])),
      markAllRead: vi.fn(() => Promise.resolve(0)),
      markRead: vi.fn(() => Promise.resolve()),
      snooze: vi.fn(() => Promise.resolve({})),
      complete: vi.fn(() => Promise.resolve()),
    };
    current = signal(workspaceOrganization('atelier-nord'));
    TestBed.configureTestingModule({
      providers: [
        InboxStore,
        { provide: InboxApi, useValue: api },
        {
          provide: RealtimeConnection,
          useValue: { personalNotices: notices, reconnected: reconnects, status: connectionStatus },
        },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: current } },
      ],
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
    TestBed.tick();
    store.open();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.reminders.hasValue() && store.notifications.hasValue()).toBe(true);
    });
    return store;
  }

  it('marks automatic loads passive when the workspace organization changes', async () => {
    await opened();
    current.set(workspaceOrganization('lumen'));
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(api.pendingReminders).toHaveBeenLastCalledWith(true);
      expect(api.notifications).toHaveBeenLastCalledWith(true);
    });
  });

  it('polls the unread count at once, every minute and when the window regains focus', async () => {
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.unreadCount()).toBe(1);

    api.unreadCount.mockReturnValue(of(3));
    expect(POLL_MS).toBe(60_000);
    await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    expect(api.unreadCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.unreadCount()).toBe(3);

    api.unreadCount.mockReturnValue(of(4));
    window.dispatchEvent(new Event('focus'));
    expect(store.unreadCount()).toBe(4);
    expect(api.unreadCount).toHaveBeenCalledTimes(3);
  });

  it('refreshes the badge and open notifications on a notification notice', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();
    await vi.advanceTimersByTimeAsync(0);
    api.unreadCount.mockReturnValue(of(4));
    api.notifications.mockResolvedValue({ items: [mention], unreadCount: 4 });
    const count: number = api.notifications.mock.calls.length;
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    await vi.waitFor(() => {
      expect(api.notifications).toHaveBeenCalledTimes(count + 1);
    });
    expect(api.notifications).toHaveBeenLastCalledWith(true);
    expect(store.unreadCount()).toBe(4);
    store.close();
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    expect(api.notifications).toHaveBeenCalledTimes(count + 1);
  });

  it('checks a due reminder before refreshing and ignores a failed check', async () => {
    await opened();
    const count: number = api.pendingReminders.mock.calls.length;
    let resolve: (value: InboxReminder) => void = () => undefined;
    api.reminder.mockReturnValueOnce(
      new Promise<InboxReminder>((done) => {
        resolve = done;
      }),
    );
    notices.next({ type: 'reminder.due.v1', reminderId: 'r1', taskId: 't1' });
    await vi.advanceTimersByTimeAsync(300);
    expect(api.reminder).toHaveBeenCalledWith('r1');
    expect(api.pendingReminders).toHaveBeenCalledTimes(count);
    resolve(reminders.items[0]);
    await Promise.resolve();
    TestBed.tick();
    await vi.waitFor(() => {
      expect(api.pendingReminders).toHaveBeenCalledTimes(count + 1);
    });
    expect(api.pendingReminders).toHaveBeenLastCalledWith(true);
    api.reminder.mockRejectedValueOnce(new Error('not found'));
    api.reminder.mockRejectedValueOnce(new Error('not found again'));
    notices.next({ type: 'reminder.due.v1', reminderId: 'r2', taskId: 't2' });
    await vi.advanceTimersByTimeAsync(1300);
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
    expect(api.pendingReminders).toHaveBeenCalledTimes(count + 2);
  });

  it('retries a failed reminder lookup once before refreshing', async () => {
    await opened();
    const count: number = api.pendingReminders.mock.calls.length;
    api.reminder.mockRejectedValueOnce(new Error('temporary'));
    notices.next({ type: 'reminder.due.v1', reminderId: 'r1', taskId: 't1' });
    await vi.advanceTimersByTimeAsync(300);
    expect(api.reminder).toHaveBeenCalledTimes(1);
    expect(api.pendingReminders).toHaveBeenCalledTimes(count);
    await vi.advanceTimersByTimeAsync(1000);
    TestBed.tick();
    expect(api.reminder).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => {
      TestBed.tick();
      expect(api.pendingReminders).toHaveBeenCalledTimes(count + 1);
    });
  });

  it('refetches badge, reminders and the open notification list after reconnect', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();
    await vi.advanceTimersByTimeAsync(0);
    const count: number = api.pendingReminders.mock.calls.length;
    const listCount: number = api.notifications.mock.calls.length;
    api.unreadCount.mockReturnValue(of(7));
    api.notifications.mockResolvedValue({ items: [mention], unreadCount: 7 });
    connectionStatus.set('reconnecting');
    TestBed.tick();
    connectionStatus.set('connected');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => {
      expect(api.pendingReminders).toHaveBeenCalledTimes(count + 1);
    });
    await vi.waitFor(() => {
      TestBed.tick();
      expect(api.notifications).toHaveBeenCalledTimes(listCount + 1);
    });
    expect(store.unreadCount()).toBe(7);
    expect(store.notifications.value()?.items).toEqual([mention]);
  });

  it('discards a due-reminder answer after switching organizations', async () => {
    await opened();
    let resolve: (value: InboxReminder) => void = () => undefined;
    api.reminder.mockReturnValueOnce(
      new Promise<InboxReminder>((done) => {
        resolve = done;
      }),
    );
    notices.next({ type: 'reminder.due.v1', reminderId: 'r1', taskId: 't1' });
    await vi.advanceTimersByTimeAsync(300);
    current.set(workspaceOrganization('another'));
    TestBed.tick();
    await vi.waitFor(() => {
      expect(api.pendingReminders.mock.calls.length).toBeGreaterThan(1);
    });
    const count: number = api.pendingReminders.mock.calls.length;
    resolve(reminders.items[0]);
    await Promise.resolve();
    TestBed.tick();
    expect(api.pendingReminders).toHaveBeenCalledTimes(count);
  });

  it('defers a notice refresh until an optimistic read write settles', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();
    await vi.advanceTimersByTimeAsync(0);
    let resolve: (value: number) => void = () => undefined;
    api.markAllRead.mockReturnValueOnce(
      new Promise<number>((done) => {
        resolve = done;
      }),
    );
    const pending: Promise<boolean> = store.markAllRead();
    const count: number = api.unreadCount.mock.calls.length;
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(300);
    expect(api.unreadCount).toHaveBeenCalledTimes(count);
    expect(store.unreadCount()).toBe(0);
    api.unreadCount.mockReturnValue(of(0));
    api.notifications.mockResolvedValue({ items: [], unreadCount: 0 });
    resolve(0);
    await pending;
    TestBed.tick();
    expect(api.unreadCount).toHaveBeenCalledTimes(count + 1);
    expect(store.unreadCount()).toBe(0);
  });

  it('retains both lists while refreshing and queues one reload during a load', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();
    let finish: (value: InboxNotificationPage) => void = () => undefined;
    api.notifications.mockReturnValueOnce(
      new Promise<InboxNotificationPage>((resolve) => {
        finish = resolve;
      }),
    );
    const initial: number = api.notifications.mock.calls.length;
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    expect(store.notifications.hasValue()).toBe(true);
    expect(store.notifications.value()?.items).toEqual([mention]);
    expect(store.pendingCount()).toBe(reminders.pendingCount);
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    finish({ items: [mention], unreadCount: 1 });
    await Promise.resolve();
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(api.notifications).toHaveBeenCalledTimes(initial + 2);
    });
    expect(store.notifications.hasValue()).toBe(true);
  });

  it('coalesces notification and reminder bursts by reminder id', async () => {
    await opened();
    await vi.advanceTimersByTimeAsync(0);
    const count: number = api.unreadCount.mock.calls.length;
    notices.next({ type: 'notification.created.v1' });
    notices.next({ type: 'notification.created.v1' });
    notices.next({ type: 'reminder.due.v1', reminderId: 'r1', taskId: 't1' });
    notices.next({ type: 'reminder.due.v1', reminderId: 'r1', taskId: 't1' });
    expect(api.reminder).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    expect(api.unreadCount).toHaveBeenCalledTimes(count + 1);
    expect(api.reminder).toHaveBeenCalledTimes(1);
  });

  it('polls every minute, connected or not, and refreshes on first admission', async () => {
    connectionStatus.set('connecting');
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.unreadCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(api.unreadCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.unreadCount).toHaveBeenCalledTimes(2);
    const remindersCount: number = api.pendingReminders.mock.calls.length;
    api.unreadCount.mockReturnValue(of(9));
    connectionStatus.set('connected');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    expect(store.unreadCount()).toBe(9);
    await vi.waitFor(() => {
      TestBed.tick();
      expect(api.pendingReminders).toHaveBeenCalledTimes(remindersCount + 1);
    });
    const count: number = api.unreadCount.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.unreadCount).toHaveBeenCalledTimes(count + 1);
  });

  it('keeps the last count when a poll fails', async () => {
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    TestBed.tick();
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

  it('publishes the reads it recorded to the other inbox views, not the refused ones', async () => {
    const store: InstanceType<typeof InboxStore> = await opened();
    const published: InboxRead[] = [];
    TestBed.inject(InboxReads).changes.subscribe((read: InboxRead) => published.push(read));

    await store.markRead(mention);
    api.markAllRead.mockRejectedValueOnce(new Error('unavailable'));
    await store.markAllRead();
    await store.markAllRead();

    expect(published).toEqual([
      { organizationId: 'atelier-nord', source: 'popover', ids: ['n1'], all: false },
      { organizationId: 'atelier-nord', source: 'popover', ids: [], all: true },
    ]);
  });

  it('refreshes the badge when the digest of the same organization records a read', async () => {
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.unreadCount()).toBe(1);
    const reads: InboxReads = TestBed.inject(InboxReads);
    api.unreadCount.mockReturnValue(of(0));

    reads.publish({ organizationId: 'lumen', source: 'digest', ids: ['n1'], all: false });
    reads.publish({ organizationId: 'atelier-nord', source: 'popover', ids: ['n1'], all: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.unreadCount).toHaveBeenCalledTimes(1);

    reads.publish({ organizationId: 'atelier-nord', source: 'digest', ids: ['n1'], all: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.unreadCount).toHaveBeenCalledTimes(2);
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

  /**
   * Function openedWithTwo
   *
   * @description
   * Opens the popover on two unread notifications.
   *
   * @returns {Promise<InstanceType<typeof InboxStore>>} The store.
   */
  async function openedWithTwo(): Promise<InstanceType<typeof InboxStore>> {
    api.notifications.mockResolvedValue({ items: [mention, other], unreadCount: 2 });
    api.unreadCount.mockReturnValue(of(2));
    return opened();
  }

  /**
   * Function readIds
   *
   * @description
   * Ids of the notifications shown read.
   *
   * @param {InstanceType<typeof InboxStore>} store - The store.
   * @returns {string[]} The read ids.
   */
  function readIds(store: InstanceType<typeof InboxStore>): string[] {
    return (store.notifications.value()?.items ?? [])
      .filter((item: InboxNotification) => item.read)
      .map((item: InboxNotification) => item.id);
  }

  it('keeps a notification read when its own write fails after mark-all succeeded', async () => {
    const store: InstanceType<typeof InboxStore> = await openedWithTwo();
    const single: Deferred<undefined> = deferred<undefined>();
    api.markRead.mockReturnValueOnce(single.promise.then((): void => undefined));

    const one: Promise<boolean> = store.markRead(mention);
    await expect(store.markAllRead()).resolves.toBe(true);
    single.reject(new Error('unavailable'));

    await expect(one).resolves.toBe(false);
    expect(readIds(store)).toEqual(['n1', 'n2']);
    expect(store.unreadCount()).toBe(0);
  });

  it('keeps a notification read when its own write fails while mark-all is pending', async () => {
    const store: InstanceType<typeof InboxStore> = await openedWithTwo();
    const all: Deferred<number> = deferred<number>();
    api.markAllRead.mockReturnValueOnce(all.promise);
    api.markRead.mockRejectedValueOnce(new Error('unavailable'));

    const everything: Promise<boolean> = store.markAllRead();
    await expect(store.markRead(mention)).resolves.toBe(false);
    expect(readIds(store)).toEqual(['n1', 'n2']);
    all.resolve(0);

    await expect(everything).resolves.toBe(true);
    expect(store.unreadCount()).toBe(0);
  });

  it('restores only the others when mark-all fails after one was confirmed', async () => {
    const store: InstanceType<typeof InboxStore> = await openedWithTwo();
    const all: Deferred<number> = deferred<number>();
    api.markAllRead.mockReturnValueOnce(all.promise);

    await expect(store.markRead(mention)).resolves.toBe(true);
    const everything: Promise<boolean> = store.markAllRead();
    all.reject(new Error('unavailable'));

    await expect(everything).resolves.toBe(false);
    expect(readIds(store)).toEqual(['n1']);
    expect(store.unreadCount()).toBe(1);
  });

  it('restores only the others when mark-all fails while one is pending, which then succeeds', async () => {
    const store: InstanceType<typeof InboxStore> = await openedWithTwo();
    const single: Deferred<undefined> = deferred<undefined>();
    api.markRead.mockReturnValueOnce(single.promise.then((): void => undefined));
    api.markAllRead.mockRejectedValueOnce(new Error('unavailable'));

    const one: Promise<boolean> = store.markRead(mention);
    await expect(store.markAllRead()).resolves.toBe(false);
    expect(readIds(store)).toEqual(['n1']);
    expect(store.unreadCount()).toBe(1);
    single.resolve(undefined);

    await expect(one).resolves.toBe(true);
    expect(readIds(store)).toEqual(['n1']);
    expect(store.unreadCount()).toBe(1);
  });

  it('drops a poll answer that began before mark-all, so the badge stays clear', async () => {
    const store: InstanceType<typeof InboxStore> = await openedWithTwo();
    const late: Deferred<number> = deferred<number>();
    api.unreadCount.mockReturnValueOnce(
      new (await import('rxjs')).Observable<number>((subscriber) => {
        void late.promise.then((count: number) => {
          subscriber.next(count);
          subscriber.complete();
        });
      }),
    );
    await vi.advanceTimersByTimeAsync(POLL_MS);

    await store.markAllRead();
    late.resolve(2);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.unreadCount()).toBe(0);
  });

  it('recovers passive reads after verification while still connected', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxStore> = await opened();
    pin.markStale();
    api.unreadCount.mockReturnValue(throwError(() => new OrganizationSwitchPendingError()));
    api.notifications.mockRejectedValue(new OrganizationSwitchPendingError());
    api.pendingReminders.mockRejectedValue(new OrganizationSwitchPendingError());
    connectionStatus.set('reconnecting');
    TestBed.tick();
    connectionStatus.set('connected');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    expect(store.notifications.status()).toBe('error');
    expect(store.reminders.status()).toBe('error');

    api.unreadCount.mockReturnValue(of(3));
    api.notifications.mockResolvedValue({ items: [mention], unreadCount: 3 });
    api.pendingReminders.mockResolvedValue(reminders);
    pin.set('atelier-nord');
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.notifications.hasValue()).toBe(true);
      expect(store.reminders.hasValue()).toBe(true);
      expect(store.unreadCount()).toBe(3);
    });
    expect(connectionStatus()).toBe('connected');
  });

  it('does not retry an unrelated read failure on verification', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    await opened();
    api.unreadCount.mockReturnValue(throwError(() => new Error('unavailable')));
    window.dispatchEvent(new Event('focus'));
    api.unreadCount.mockClear();
    api.notifications.mockClear();
    api.pendingReminders.mockClear();
    pin.set('atelier-nord');
    expect(api.unreadCount).not.toHaveBeenCalled();
    expect(api.notifications).not.toHaveBeenCalled();
    expect(api.pendingReminders).not.toHaveBeenCalled();
  });

  it('does not recover old reads under a newly committed organization pin', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    await opened();
    api.unreadCount.mockReturnValue(throwError(() => new OrganizationSwitchPendingError()));
    window.dispatchEvent(new Event('focus'));
    api.unreadCount.mockClear();
    current.set(workspaceOrganization('lumen'));
    pin.set('lumen');
    expect(api.unreadCount).not.toHaveBeenCalled();
    TestBed.tick();
  });

  it('recovers a first passive 412 without another fenced request', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxStore> = await opened();
    api.notifications.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 412,
        error: { code: 'organization.context-changed' },
      }),
    );
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.notifications.status()).toBe('error');
    });
    api.notifications.mockClear();
    pin.set('atelier-nord');
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.notifications.hasValue()).toBe(true);
    });
    expect(api.notifications).toHaveBeenCalledTimes(1);
    expect(api.notifications).toHaveBeenCalledWith(true);
  });

  it('recovers while reconnecting and skips the same reads on connection', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxStore> = await opened();
    api.unreadCount.mockReturnValue(throwError(() => new OrganizationSwitchPendingError()));
    api.notifications.mockRejectedValue(new OrganizationSwitchPendingError());
    api.pendingReminders.mockRejectedValue(new OrganizationSwitchPendingError());
    connectionStatus.set('reconnecting');
    TestBed.tick();
    connectionStatus.set('connected');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    expect(store.notifications.status()).toBe('error');
    expect(store.reminders.status()).toBe('error');
    connectionStatus.set('reconnecting');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    api.unreadCount.mockReturnValue(of(3));
    api.notifications.mockResolvedValue({ items: [mention], unreadCount: 3 });
    api.pendingReminders.mockResolvedValue(reminders);
    api.unreadCount.mockClear();
    api.notifications.mockClear();
    api.pendingReminders.mockClear();
    pin.set('atelier-nord');
    TestBed.tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.notifications.hasValue()).toBe(true);
      expect(store.reminders.hasValue()).toBe(true);
      expect(store.unreadCount()).toBe(3);
    });
    expect(connectionStatus()).toBe('reconnecting');
    expect(api.unreadCount).toHaveBeenCalledTimes(1);
    expect(api.notifications).toHaveBeenCalledTimes(1);
    expect(api.pendingReminders).toHaveBeenCalledTimes(1);
    connectionStatus.set('connected');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    expect(api.unreadCount).toHaveBeenCalledTimes(1);
    expect(api.notifications).toHaveBeenCalledTimes(1);
    expect(api.pendingReminders).toHaveBeenCalledTimes(1);
  });

  it('does not cycle verification after a refused recovery read', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    await opened();
    api.unreadCount.mockReturnValue(throwError(() => new OrganizationSwitchPendingError()));
    window.dispatchEvent(new Event('focus'));
    api.unreadCount.mockClear();
    api.unreadCount.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 412,
            error: { code: 'organization.context-changed' },
          }),
      ),
    );
    pin.set('atelier-nord');
    expect(api.unreadCount).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('focus'));
    api.unreadCount.mockClear();
    pin.set('atelier-nord');
    expect(api.unreadCount).not.toHaveBeenCalled();
  });

  it('clears everything and polls the new organization on a switch, ignoring the old answers', async () => {
    const store: InstanceType<typeof InboxStore> = await openedWithTwo();
    const all: Deferred<number> = deferred<number>();
    api.markAllRead.mockReturnValueOnce(all.promise);
    const everything: Promise<boolean> = store.markAllRead();
    api.unreadCount.mockReturnValue(of(5));

    current.set(workspaceOrganization('lumen'));
    TestBed.tick();
    expect(store.notifications.hasValue()).toBe(false);
    expect(store.reminders.hasValue()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.unreadCount()).toBe(5);

    all.reject(new Error('unavailable'));
    await everything;
    expect(store.unreadCount()).toBe(5);
  });
});

describe('InboxStore passive requests', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('marks an initial reminders mismatch stale', async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([organizationPinInterceptor])),
        provideHttpClientTesting(),
        InboxStore,
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ id: 'organization-a' }) },
        },
      ],
    });
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('organization-a');
    const changed: Mock<() => void> = vi.fn();
    pin.contextChanged.subscribe(changed);
    const store: InstanceType<typeof InboxStore> = TestBed.inject(InboxStore);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const reminders: TestRequest = http.expectOne((request) => request.url === '/v1/reminders');
    expect(reminders.request.context.get(PASSIVE_REQUEST)).toBe(true);
    expect(reminders.request.headers.get('If-Organization-Match')).toBe('organization-a');
    const badge: TestRequest = http.expectOne('/v1/inbox/unread-count');
    badge.flush({ unreadCount: 0 });
    reminders.flush(
      { code: 'organization.context-changed' },
      { status: 412, statusText: 'Precondition Failed' },
    );
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    expect(pin.stale()).toBe(true);
    expect(changed).toHaveBeenCalledOnce();
    expect(store.reminders.error()).toBeDefined();
    pin.set('organization-a');
    TestBed.tick();
    store.reminders.reload();
    TestBed.tick();
    const retry: TestRequest = http.expectOne((request) => request.url === '/v1/reminders');
    expect(retry.request.context.get(PASSIVE_REQUEST)).toBe(false);
    retry.flush({ items: [], pendingCount: 0 });
    http.verify();
  });
});
