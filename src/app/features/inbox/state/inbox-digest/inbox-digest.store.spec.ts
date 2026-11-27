import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
import { RealtimeConnection, type PersonalNotice } from '@core/realtime';

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
import { InboxReads } from '../../services/inbox-reads/inbox-reads.service';
import { InboxDigestStore, NOTICE_AUDIT_MS } from './inbox-digest.store';

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
 * Constant comment
 *
 * @description
 * A read comment on CAD-475.
 *
 * @type {InboxNotification}
 */
const comment: InboxNotification = {
  ...mention,
  id: 'n2',
  kind: 'comment',
  taskKey: 'CAD-475',
  excerpt: null,
  read: true,
};

/**
 * Function page
 *
 * @description
 * A page of the given notifications.
 *
 * @param {readonly InboxNotification[]} items - Its notifications.
 * @returns {InboxNotificationPage} The page.
 */
function page(...items: readonly InboxNotification[]): InboxNotificationPage {
  return { items, unreadCount: items.filter((item: InboxNotification) => !item.read).length };
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
 * Function deferred
 *
 * @description
 * A promise the test settles, with its settlers.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void }} The promise and its settlers.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
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

describe('InboxDigestStore', () => {
  let notifications: Mock<(passive?: boolean) => Promise<InboxNotificationPage>>;
  let markRead: Mock<(id: string) => Promise<void>>;
  let current: WritableSignal<WorkspaceOrganization>;
  let notices: Subject<PersonalNotice>;
  let reconnects: Subject<void>;

  beforeEach(() => {
    vi.useFakeTimers();
    notifications = vi.fn(() => Promise.resolve(page(mention, comment)));
    markRead = vi.fn(() => Promise.resolve());
    current = signal(workspaceOrganization('atelier-nord'));
    notices = new Subject<PersonalNotice>();
    reconnects = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        InboxDigestStore,
        { provide: InboxApi, useValue: { notifications, markRead } },
        {
          provide: RealtimeConnection,
          useValue: { personalNotices: notices, reconnected: reconnects },
        },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: current } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function loaded
   *
   * @description
   * Creates the store and waits for its first page.
   *
   * @returns {Promise<InstanceType<typeof InboxDigestStore>>} The store.
   */
  async function loaded(): Promise<InstanceType<typeof InboxDigestStore>> {
    const store: InstanceType<typeof InboxDigestStore> = TestBed.inject(InboxDigestStore);
    await settle(store);
    return store;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the store has neither a pending first read nor a running refresh.
   *
   * @param {InstanceType<typeof InboxDigestStore>} store - The store.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(store: InstanceType<typeof InboxDigestStore>): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.loading()).toBe(false);
    });
    for (let round: number = 0; round < 3; round += 1) {
      await vi.advanceTimersByTimeAsync(0);
      TestBed.tick();
    }
  }

  it('reads the first page actively and shows it', async () => {
    const store: InstanceType<typeof InboxDigestStore> = TestBed.inject(InboxDigestStore);
    TestBed.tick();
    expect(store.loading()).toBe(true);
    expect(store.items()).toEqual([]);

    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(1);
    expect(notifications).toHaveBeenCalledWith(false);
    expect(store.items()).toEqual([mention, comment]);
    expect(store.empty()).toBe(false);
    expect(store.failed()).toBe(false);
  });

  it('tells a successful empty page from a failed read, and Retry reads actively', async () => {
    notifications.mockResolvedValueOnce(page());
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    expect(store.empty()).toBe(true);
    expect(store.failed()).toBe(false);

    notifications.mockRejectedValueOnce(new Error('unavailable'));
    store.retry();
    await settle(store);
    expect(store.failed()).toBe(true);
    expect(store.empty()).toBe(false);
    expect(store.items()).toEqual([]);

    store.retry();
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(3);
    expect(notifications).toHaveBeenLastCalledWith(false);
    expect(store.failed()).toBe(false);
    expect(store.items()).toEqual([mention, comment]);
  });

  it('reads the page passively once per burst of notification notices', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const fresh: InboxNotification = { ...mention, id: 'n3', taskKey: 'CAD-490' };
    notifications.mockResolvedValue(page(fresh, mention, comment));

    notices.next({ type: 'notification.created.v1' });
    notices.next({ type: 'notification.created.v1' });
    notices.next({ type: 'reminder.due.v1', reminderId: 'r1', taskId: 't1' });
    await vi.advanceTimersByTimeAsync(NOTICE_AUDIT_MS);
    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(2);
    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.items().map((item: InboxNotification) => item.id)).toEqual(['n3', 'n1', 'n2']);
  });

  it('keeps the rows while a background refresh runs', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const pending: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(pending.promise);

    reconnects.next();
    TestBed.tick();

    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.loading()).toBe(false);
    expect(store.items()).toEqual([mention, comment]);
    pending.resolve(page(comment));
    await settle(store);
    expect(store.items()).toEqual([comment]);
  });

  it('reads again a notice that arrives during the first read', async () => {
    const pending: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(pending.promise);
    const store: InstanceType<typeof InboxDigestStore> = TestBed.inject(InboxDigestStore);
    TestBed.tick();

    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(NOTICE_AUDIT_MS);
    expect(notifications).toHaveBeenCalledTimes(1);
    pending.resolve(page(mention));
    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(2);
    expect(notifications).toHaveBeenLastCalledWith(true);
  });

  it('marks an opened notification read at once and keeps it read', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const write: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    markRead.mockReturnValueOnce(write.promise);

    const done: Promise<boolean> = store.markRead(mention);

    expect(markRead).toHaveBeenCalledWith('n1');
    expect(store.items()[0]?.read).toBe(true);
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(NOTICE_AUDIT_MS);
    await settle(store);
    expect(store.items()[0]?.read).toBe(true);
    write.resolve(undefined);
    await expect(done).resolves.toBe(true);
    expect(store.items()[0]?.read).toBe(true);
  });

  it('sends nothing for a notification already read', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();

    await expect(store.markRead(comment)).resolves.toBe(true);

    expect(markRead).not.toHaveBeenCalled();
  });

  it('shows a notification unread again when its read is refused', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    markRead.mockRejectedValueOnce(new Error('unavailable'));

    await expect(store.markRead(mention)).resolves.toBe(false);

    expect(store.items()[0]?.read).toBe(false);
    markRead.mockResolvedValueOnce();
    await expect(store.markRead(mention)).resolves.toBe(true);
    expect(markRead).toHaveBeenCalledTimes(2);
    expect(store.items()[0]?.read).toBe(true);
  });

  it('drops the previous rows on an organization switch and reads the new ones passively', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    await store.markRead(mention);
    const pending: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(pending.promise);

    current.set(workspaceOrganization('lumen'));
    TestBed.tick();

    expect(store.loading()).toBe(true);
    expect(store.items()).toEqual([]);
    expect(notifications).toHaveBeenLastCalledWith(true);
    pending.resolve(page({ ...mention }));
    await settle(store);
    expect(store.items()[0]?.read).toBe(false);
  });

  it('reads again, once, a passive read refused until the workspace is verified', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    notifications.mockRejectedValueOnce(new OrganizationSwitchPendingError());

    reconnects.next();
    await settle(store);
    expect(store.failed()).toBe(true);

    pin.set('atelier-nord');
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(3);
    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.failed()).toBe(false);

    pin.set('atelier-nord');
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(3);
  });

  it('reads again a notice that arrives during a background refresh', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const refresh: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(refresh.promise);
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(NOTICE_AUDIT_MS);
    TestBed.tick();
    expect(notifications).toHaveBeenCalledTimes(2);

    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(NOTICE_AUDIT_MS);
    TestBed.tick();
    expect(notifications).toHaveBeenCalledTimes(2);
    refresh.resolve(page(mention));
    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(3);
    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.items()).toEqual([mention, comment]);
  });

  it('keeps the failure shown with Retry busy while a retry runs, and ignores a second Retry', async () => {
    notifications.mockRejectedValueOnce(new Error('unavailable'));
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    expect(store.failed()).toBe(true);
    const retried: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(retried.promise);

    store.retry();
    TestBed.tick();
    store.retry();

    expect(store.retrying()).toBe(true);
    expect(store.failed()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(notifications).toHaveBeenCalledTimes(2);
    retried.resolve(page(mention));
    await settle(store);
    expect(store.retrying()).toBe(false);
    expect(store.failed()).toBe(false);
    expect(store.items()).toEqual([mention]);
    expect(notifications).toHaveBeenCalledTimes(2);
  });

  it('reads again after a verification that arrives during Retry', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    notifications.mockRejectedValueOnce(new OrganizationSwitchPendingError());
    reconnects.next();
    await settle(store);
    expect(store.failed()).toBe(true);
    const retried: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(retried.promise);

    store.retry();
    TestBed.tick();
    pin.set('atelier-nord');
    retried.reject(new Error('unavailable'));
    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(4);
    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.failed()).toBe(false);
  });

  it('retries a second stale period of the same verified context', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    notifications.mockRejectedValueOnce(new OrganizationSwitchPendingError());
    reconnects.next();
    await settle(store);
    pin.set('atelier-nord');
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(3);
    expect(store.failed()).toBe(false);

    pin.markStale();
    notifications.mockRejectedValueOnce(new OrganizationSwitchPendingError());
    reconnects.next();
    await settle(store);
    expect(store.failed()).toBe(true);
    pin.set('atelier-nord');
    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(5);
    expect(store.failed()).toBe(false);
  });

  it('resumes a read refused by a switch that starts after a verified retry', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    notifications.mockRejectedValueOnce(new OrganizationSwitchPendingError());
    reconnects.next();
    await settle(store);
    pin.set('atelier-nord');
    await settle(store);

    pin.beginSwitch();
    notifications.mockRejectedValueOnce(new OrganizationSwitchPendingError());
    notices.next({ type: 'notification.created.v1' });
    await vi.advanceTimersByTimeAsync(NOTICE_AUDIT_MS);
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(4);
    pin.set('atelier-nord');
    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(5);
    expect(store.failed()).toBe(false);
  });

  it('reads again at once a refusal that lands after the context was verified', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const refused: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(refused.promise);
    reconnects.next();
    TestBed.tick();

    pin.set('atelier-nord');
    refused.reject(new OrganizationSwitchPendingError());
    await settle(store);

    expect(notifications).toHaveBeenCalledTimes(3);
    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.failed()).toBe(false);
  });

  it('ignores the failure of a write sent before switching away and back', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const first: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    markRead.mockReturnValueOnce(first.promise);
    const stale: Promise<boolean> = store.markRead(mention);
    current.set(workspaceOrganization('lumen'));
    await settle(store);
    current.set(workspaceOrganization('atelier-nord'));
    await settle(store);
    const second: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    markRead.mockReturnValueOnce(second.promise);
    const fresh: Promise<boolean> = store.markRead(mention);
    expect(store.items()[0]?.read).toBe(true);

    first.reject(new Error('unavailable'));
    await expect(stale).resolves.toBe(true);

    expect(store.items()[0]?.read).toBe(true);
    second.resolve(undefined);
    await expect(fresh).resolves.toBe(true);
  });

  it('shows the reads recorded in the popover of the same organization', async () => {
    const other: InboxNotification = { ...mention, id: 'n3' };
    notifications.mockResolvedValueOnce(page(mention, other, comment));
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const reads: InboxReads = TestBed.inject(InboxReads);

    reads.publish({ organizationId: 'lumen', source: 'popover', ids: ['n1'], all: false });
    reads.publish({ organizationId: 'atelier-nord', source: 'digest', ids: ['n1'], all: false });
    expect(store.items()[0]?.read).toBe(false);
    reads.publish({ organizationId: 'atelier-nord', source: 'popover', ids: ['n1'], all: false });

    expect(store.items().map((item: InboxNotification) => item.read)).toEqual([true, false, true]);
    expect(notifications).toHaveBeenCalledTimes(1);
  });

  it('reconciles a popover mark-all from a fresh read, keeping a newer notification unread', async () => {
    const newer: InboxNotification = { ...mention, id: 'n5', taskKey: 'CAD-491' };
    notifications.mockResolvedValueOnce(page(newer, mention, comment));
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    notifications.mockResolvedValueOnce(page(newer, { ...mention, read: true }, comment));

    TestBed.inject(InboxReads).publish({
      organizationId: 'atelier-nord',
      source: 'popover',
      ids: ['n1'],
      all: true,
    });

    expect(store.items().map((item: InboxNotification) => item.read)).toEqual([false, true, true]);
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(2);
    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.items().map((item: InboxNotification) => item.read)).toEqual([false, true, true]);
  });

  it('shows a recorded read on pages read before it, and the server state on later ones', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const before: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(before.promise);
    reconnects.next();
    TestBed.tick();

    TestBed.inject(InboxReads).publish({
      organizationId: 'atelier-nord',
      source: 'popover',
      ids: ['n1'],
      all: false,
    });
    before.resolve(page(mention, comment));
    await settle(store);
    expect(store.items()[0]?.read).toBe(true);

    reconnects.next();
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(3);
    expect(store.items()[0]?.read).toBe(false);
  });

  it('keeps a read the popover recorded when the digest write for it fails, without a toast', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const write: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    markRead.mockReturnValueOnce(write.promise);
    const done: Promise<boolean> = store.markRead(mention);

    TestBed.inject(InboxReads).publish({
      organizationId: 'atelier-nord',
      source: 'popover',
      ids: ['n1'],
      all: false,
    });
    write.reject(new Error('unavailable'));

    await expect(done).resolves.toBe(true);
    expect(store.items()[0]?.read).toBe(true);
  });

  it('does not report the failure of a write sent before an organization switch', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const write: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    markRead.mockReturnValueOnce(write.promise);
    const done: Promise<boolean> = store.markRead(mention);
    current.set(workspaceOrganization('lumen'));
    await settle(store);

    write.reject(new Error('unavailable'));

    await expect(done).resolves.toBe(true);
  });

  it('keeps the current retry obligation when an older organization read settles late', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    const old: ReturnType<typeof deferred<InboxNotificationPage>> =
      deferred<InboxNotificationPage>();
    notifications.mockReturnValueOnce(old.promise);
    const store: InstanceType<typeof InboxDigestStore> = TestBed.inject(InboxDigestStore);
    TestBed.tick();
    expect(notifications).toHaveBeenCalledTimes(1);

    notifications.mockRejectedValueOnce(new OrganizationSwitchPendingError());
    current.set(workspaceOrganization('lumen'));
    await settle(store);
    expect(store.failed()).toBe(true);
    old.resolve(page(mention));
    await settle(store);

    pin.set('lumen');
    await settle(store);
    expect(notifications).toHaveBeenCalledTimes(3);
    expect(notifications).toHaveBeenLastCalledWith(true);
    expect(store.failed()).toBe(false);
  });

  it('tells the popover about the reads it recorded, not the refused ones', async () => {
    const store: InstanceType<typeof InboxDigestStore> = await loaded();
    const published: InboxRead[] = [];
    TestBed.inject(InboxReads).changes.subscribe((read: InboxRead) => published.push(read));
    markRead.mockRejectedValueOnce(new Error('unavailable'));

    await store.markRead(mention);
    await store.markRead(mention);

    expect(published).toEqual([
      { organizationId: 'atelier-nord', source: 'digest', ids: ['n1'], all: false },
    ]);
  });
});
