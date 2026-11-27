import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
import { RealtimeConnection } from '@core/realtime';

import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';

import { ArchivesApi } from '../../data-access/services/archives-api/archives-api.service';
import type { ArchivedListItem } from '../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../models/archived-task/archived-task.interface';
import type { ArchivesRead } from '../../models/archives-read/archives-read.interface';
import { ARCHIVES_CONFIRM_DELAYS_MS } from './archives-confirm-delays.token';
import { ArchivesStore, REFRESH_AUDIT_MS } from './archives.store';

/**
 * Constant sprint13
 *
 * @description
 * The mockup's archived `Sprint 13` of the Product space, archived by Camille Martin.
 *
 * @type {ArchivedListItem}
 */
const sprint13: ArchivedListItem = {
  id: 'l-sprint13',
  name: 'Sprint 13',
  spaceId: 'sp-product',
  sprint: true,
  taskCount: 14,
  archivedAt: '2026-11-03T09:00:00Z',
  archivedBy: 'u-camille',
  restorable: true,
};

/**
 * Constant campaign
 *
 * @description
 * The mockup's second archived list, of the Marketing space.
 *
 * @type {ArchivedListItem}
 */
const campaign: ArchivedListItem = {
  id: 'l-campaign',
  name: 'Back-to-school campaign',
  spaceId: 'sp-marketing',
  sprint: false,
  taskCount: 6,
  archivedAt: '2026-10-12T09:00:00Z',
  archivedBy: 'u-lea',
  restorable: true,
};

/**
 * Constant cad430
 *
 * @description
 * The mockup's archived task `CAD-430` of `Sprint 14`.
 *
 * @type {ArchivedTaskItem}
 */
const cad430: ArchivedTaskItem = {
  key: 'CAD-430',
  name: 'Old pricing page',
  status: 'done',
  milestone: false,
  listName: 'Sprint 14',
  listArchived: false,
  archivedAt: '2026-11-05T11:30:00Z',
  archivedBy: 'u-hugo',
};

/**
 * Function archives
 *
 * @description
 * A read of the archives holding the given lists and tasks.
 *
 * @param {readonly ArchivedListItem[]} lists - The archived lists.
 * @param {readonly ArchivedTaskItem[]} tasks - The archived tasks.
 * @returns {ArchivesRead} The read.
 */
function archives(
  lists: readonly ArchivedListItem[],
  tasks: readonly ArchivedTaskItem[],
): ArchivesRead {
  return { lists, listTotal: lists.length, tasks, taskTotal: tasks.length };
}

/**
 * Function deferred
 *
 * @description
 * A promise settled by the test.
 *
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }}
 * The promise and its settlers.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise: Promise<T> = new Promise<T>(
    (done: (value: T) => void, fail: (error: unknown) => void) => {
      resolve = done;
      reject = fail;
    },
  );
  return { promise, resolve, reject };
}

/**
 * Constant forbidden
 *
 * @description
 * The gateway's refusal of a restore by a caller without `edit` on the list.
 *
 * @type {HttpErrorResponse}
 */
const forbidden: HttpErrorResponse = new HttpErrorResponse({
  status: 403,
  error: { code: 'access.role-insufficient', title: 'Insufficient role', status: 403 },
});

describe('ArchivesStore', () => {
  let api: Record<
    'read' | 'memberNames' | 'unarchiveList' | 'unarchiveTask' | 'checkList' | 'checkTask',
    Mock
  >;
  let navigation: { refresh: Mock; refreshCounts: Mock };
  let reconnected: Subject<void>;

  beforeEach(() => {
    api = {
      read: vi.fn(() => Promise.resolve(archives([sprint13, campaign], [cad430]))),
      memberNames: vi.fn(() =>
        Promise.resolve(
          new Map<string, string>([
            ['u-camille', 'Camille Martin'],
            ['u-hugo', 'Hugo Dubois'],
          ]),
        ),
      ),
      unarchiveList: vi.fn(() => Promise.resolve()),
      unarchiveTask: vi.fn(() => Promise.resolve()),
      checkList: vi.fn(() => Promise.resolve('archived')),
      checkTask: vi.fn(() => Promise.resolve('archived')),
    };
    navigation = { refresh: vi.fn(), refreshCounts: vi.fn() };
    reconnected = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ArchivesStore,
        { provide: ArchivesApi, useValue: api },
        { provide: NAVIGATION_REFRESH, useValue: navigation },
        { provide: RealtimeConnection, useValue: { reconnected } },
        { provide: ARCHIVES_CONFIRM_DELAYS_MS, useValue: [1, 1, 1] },
      ],
    });
    TestBed.inject(OrganizationPin).set('org-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Function loaded
   *
   * @description
   * Creates the store and waits for its first read.
   *
   * @returns {Promise<InstanceType<typeof ArchivesStore>>} The store.
   */
  async function loaded(): Promise<InstanceType<typeof ArchivesStore>> {
    const store: InstanceType<typeof ArchivesStore> = TestBed.inject(ArchivesStore);
    TestBed.tick();
    await expect.poll(() => store.archives.hasValue()).toBe(true);
    return store;
  }

  it('reads both tabs actively, with the totals and the member names', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();

    expect(api.read).toHaveBeenCalledWith(false, expect.any(AbortSignal));
    expect(store.lists()).toEqual([sprint13, campaign]);
    expect(store.tasks()).toEqual([cad430]);
    expect(store.listCount()).toBe(2);
    expect(store.taskCount()).toBe(1);
    await expect.poll(() => store.memberNames().get('u-hugo')).toBe('Hugo Dubois');
  });

  it('keeps a failed first read as an error, never as empty tabs', async () => {
    api.read.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const store: InstanceType<typeof ArchivesStore> = TestBed.inject(ArchivesStore);
    TestBed.tick();

    await expect.poll(() => store.archives.status()).toBe('error');
    expect(store.lists()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('keeps the rows when a background read fails', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.read.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    reconnected.next();

    await expect.poll(() => api.read.mock.calls.length, { timeout: 2000 }).toBe(2);
    expect(api.read).toHaveBeenLastCalledWith(true, expect.any(AbortSignal));
    await expect.poll(() => store.archives.isLoading()).toBe(false);
    expect(store.archives.status()).not.toBe('error');
    expect(store.lists()).toEqual([sprint13, campaign]);
  });

  it('removes a confirmed list, refreshes the sidebar and reads the archives again', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.read.mockResolvedValue(archives([campaign], [cad430]));

    const restoring: Promise<string> = store.restoreList(sprint13);
    expect(store.listPending(sprint13.id)).toBe(true);

    await expect(restoring).resolves.toBe('restored');
    expect(store.listPending(sprint13.id)).toBe(false);
    expect(store.lists()).toEqual([campaign]);
    expect(store.listCount()).toBe(1);
    expect(api.unarchiveList).toHaveBeenCalledWith(sprint13.id);
    expect(navigation.refresh).toHaveBeenCalledOnce();
    await expect.poll(() => api.read.mock.calls.length).toBe(2);
  });

  it('never lets an older read in flight bring a confirmed restore back', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    const older: ReturnType<typeof deferred<ArchivesRead>> = deferred<ArchivesRead>();
    api.read.mockReturnValueOnce(older.promise);
    reconnected.next();
    await expect.poll(() => api.read.mock.calls.length, { timeout: 2000 }).toBe(2);
    api.read.mockResolvedValue(archives([campaign], []));

    await expect(store.restoreTask(cad430)).resolves.toBe('restored');
    older.resolve(archives([sprint13, campaign], [cad430]));

    await expect.poll(() => api.read.mock.calls.length).toBe(3);
    expect(store.tasks()).toEqual([]);
    expect(store.taskCount()).toBe(0);
    await expect.poll(() => store.lists()).toEqual([campaign]);
  });

  it('shows the gateway word again once a read starts after the restore', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.read.mockResolvedValue(archives([sprint13, campaign], [cad430]));

    await store.restoreTask(cad430);

    await expect.poll(() => api.read.mock.calls.length).toBe(2);
    await expect.poll(() => store.tasks()).toEqual([cad430]);
  });

  it('reports a refusal and keeps the row', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveList.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));

    await expect(store.restoreList(sprint13)).resolves.toBe('refused');

    expect(store.listPending(sprint13.id)).toBe(false);
    expect(store.lists()).toEqual([sprint13, campaign]);
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it('tells a missing edit right from another refusal', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveTask.mockRejectedValueOnce(forbidden);

    await expect(store.restoreTask(cad430)).resolves.toBe('forbidden');

    expect(store.taskPending(cad430.key)).toBe(false);
    expect(store.tasks()).toEqual([cad430]);
  });

  it('keeps the row pending through an unknown outcome until a later read confirms it', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveTask.mockRejectedValueOnce(new HttpErrorResponse({ status: 504 }));
    const first: ReturnType<typeof deferred<string>> = deferred<string>();
    api.checkTask.mockReturnValueOnce(first.promise).mockResolvedValueOnce('restored');
    api.read.mockResolvedValue(archives([sprint13, campaign], []));
    const leaving: Mock = vi.fn();

    const restoring: Promise<string> = store.restoreTask(cad430, leaving);
    await expect.poll(() => api.checkTask.mock.calls.length).toBe(1);
    expect(store.taskPending(cad430.key)).toBe(true);
    expect(store.tasks()).toEqual([cad430]);
    first.resolve('archived');

    await expect(restoring).resolves.toBe('restored');
    expect(api.checkTask).toHaveBeenCalledTimes(2);
    expect(leaving).toHaveBeenCalledOnce();
    expect(store.taskPending(cad430.key)).toBe(false);
    expect(store.tasks()).toEqual([]);
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });

  it('reports an unconfirmed outcome after the last confirmation read, then reads again', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveList.mockRejectedValueOnce(new HttpErrorResponse({ status: 502 }));
    api.checkList.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    await expect(store.restoreList(sprint13)).resolves.toBe('unconfirmed');

    expect(api.checkList).toHaveBeenCalledTimes(3);
    expect(store.listPending(sprint13.id)).toBe(false);
    expect(store.lists()).toEqual([sprint13, campaign]);
    expect(navigation.refresh).toHaveBeenCalledOnce();
    await expect.poll(() => api.read.mock.calls.length).toBe(2);
  });

  it('handles a timed-out write as an unknown outcome, never as a refusal', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveList.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 0,
        statusText: 'Request timeout',
        error: new DOMException('Request timed out', 'TimeoutError'),
      }),
    );
    api.checkList.mockResolvedValueOnce('restored');

    await expect(store.restoreList(sprint13)).resolves.toBe('restored');

    expect(api.checkList).toHaveBeenCalledOnce();
    expect(store.lists()).toEqual([campaign]);
  });

  it('stops confirming once the item is gone', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveTask.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));
    api.checkTask.mockResolvedValueOnce('gone');

    await expect(store.restoreTask(cad430)).resolves.toBe('unconfirmed');

    expect(api.checkTask).toHaveBeenCalledOnce();
  });

  it('reports stale and reads nothing when the organization was switching', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveList.mockRejectedValueOnce(new OrganizationSwitchPendingError());

    await expect(store.restoreList(sprint13)).resolves.toBe('stale');

    expect(store.listPending(sprint13.id)).toBe(false);
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(api.checkList).not.toHaveBeenCalled();
    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, 20);
    });
    expect(api.read).toHaveBeenCalledOnce();
  });

  it('ignores a restore that ends after the store is destroyed', async () => {
    const injector: EnvironmentInjector = createEnvironmentInjector(
      [ArchivesStore],
      TestBed.inject(EnvironmentInjector),
    );
    const store: InstanceType<typeof ArchivesStore> = injector.get(ArchivesStore);
    TestBed.tick();
    await expect.poll(() => store.archives.hasValue()).toBe(true);
    const write: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    api.unarchiveList.mockReturnValueOnce(write.promise);
    const leaving: Mock = vi.fn();

    const restoring: Promise<string> = store.restoreList(sprint13, leaving);
    injector.destroy();
    write.resolve(undefined);

    await expect(restoring).resolves.toBe('stale');
    expect(leaving).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it('ignores a restore whose organization went to another and came back', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    const write: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    api.unarchiveList.mockReturnValueOnce(write.promise);
    const restoring: Promise<string> = store.restoreList(sprint13);

    pin.set('org-2');
    TestBed.tick();
    api.read.mockResolvedValue(archives([sprint13, campaign], [cad430]));
    pin.set('org-1');
    TestBed.tick();
    write.resolve(undefined);

    await expect(restoring).resolves.toBe('stale');
    expect(navigation.refresh).not.toHaveBeenCalled();
    await expect.poll(() => store.archives.isLoading()).toBe(false);
    expect(store.lists()).toEqual([sprint13, campaign]);
    expect(store.listPending(sprint13.id)).toBe(false);
  });

  it('reads once at the end of a burst of focus and visibility triggers', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const store: InstanceType<typeof ArchivesStore> = await loaded();

    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    expect(api.read).toHaveBeenCalledOnce();

    await expect.poll(() => api.read.mock.calls.length, { timeout: 2000 }).toBe(2);
    expect(api.read).toHaveBeenLastCalledWith(true, expect.any(AbortSignal));
    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, REFRESH_AUDIT_MS + 50);
    });
    expect(api.read).toHaveBeenCalledTimes(2);
    expect(store.lists()).toEqual([sprint13, campaign]);
  });

  it('queues one read asked for while another runs', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    const running: ReturnType<typeof deferred<ArchivesRead>> = deferred<ArchivesRead>();
    api.read.mockReturnValueOnce(running.promise);
    reconnected.next();
    await expect.poll(() => api.read.mock.calls.length, { timeout: 2000 }).toBe(2);

    reconnected.next();
    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, REFRESH_AUDIT_MS + 50);
    });
    reconnected.next();
    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, REFRESH_AUDIT_MS + 50);
    });
    expect(api.read).toHaveBeenCalledTimes(2);
    running.resolve(archives([campaign], []));

    await expect.poll(() => api.read.mock.calls.length).toBe(3);
    await expect.poll(() => store.archives.isLoading()).toBe(false);
    expect(api.read).toHaveBeenCalledTimes(3);
  });

  it('reads the member names again with the next read after they failed', async () => {
    api.memberNames.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    await expect.poll(() => api.memberNames.mock.calls.length).toBe(1);
    expect(store.memberNames().size).toBe(0);

    reconnected.next();

    await expect.poll(() => api.memberNames.mock.calls.length, { timeout: 2000 }).toBe(2);
    await expect.poll(() => store.memberNames().get('u-camille')).toBe('Camille Martin');
  });

  it('ignores a restore whose organization changed while it ran', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    const write: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    api.unarchiveList.mockReturnValueOnce(write.promise);
    const restoring: Promise<string> = store.restoreList(sprint13);
    api.read.mockResolvedValue(archives([sprint13], []));

    TestBed.inject(OrganizationPin).set('org-2');
    TestBed.tick();
    write.resolve(undefined);

    await expect(restoring).resolves.toBe('stale');
    expect(navigation.refresh).not.toHaveBeenCalled();
    await expect.poll(() => store.lists()).toEqual([sprint13]);
    expect(store.listPending(sprint13.id)).toBe(false);
  });

  it('sends one restore of an item at a time', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    const write: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    api.unarchiveList.mockReturnValueOnce(write.promise);

    const first: Promise<string> = store.restoreList(sprint13);
    await expect(store.restoreList(sprint13)).resolves.toBe('stale');
    write.resolve(undefined);

    await expect(first).resolves.toBe('restored');
    expect(api.unarchiveList).toHaveBeenCalledOnce();
  });
});
