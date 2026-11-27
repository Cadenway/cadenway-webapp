import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { RealtimeConnection } from '@core/realtime';

import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';

import { ArchivesApi } from '../../data-access/services/archives-api/archives-api.service';
import type { ArchivedListItem } from '../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../models/archived-task/archived-task.interface';
import type { ArchivesRead } from '../../models/archives-read/archives-read.interface';
import { ArchivesStore } from './archives.store';

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

describe('ArchivesStore', () => {
  let api: Record<'read' | 'memberNames' | 'unarchiveList' | 'unarchiveTask', Mock>;
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
      ],
    });
    TestBed.inject(OrganizationPin).set('org-1');
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
    api.unarchiveList.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));

    await expect(store.restoreList(sprint13)).resolves.toBe('refused');

    expect(store.listPending(sprint13.id)).toBe(false);
    expect(store.lists()).toEqual([sprint13, campaign]);
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it('reads again after an unknown outcome instead of reporting a failure', async () => {
    const store: InstanceType<typeof ArchivesStore> = await loaded();
    api.unarchiveTask.mockRejectedValueOnce(new HttpErrorResponse({ status: 504 }));
    api.read.mockResolvedValue(archives([sprint13, campaign], []));

    await expect(store.restoreTask(cad430)).resolves.toBe('unknown');

    expect(navigation.refresh).toHaveBeenCalledOnce();
    await expect.poll(() => store.tasks()).toEqual([]);
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
