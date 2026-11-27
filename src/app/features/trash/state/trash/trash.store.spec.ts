import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  type MockInstance,
  vi,
} from 'vitest';

import { OrganizationPin } from '@core/api';

import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';

import { TrashApi } from '../../data-access/services/trash-api/trash-api.service';
import type { TrashEntry } from '../../models/trash-entry/trash-entry.interface';
import type { TrashRestore } from '../../models/trash-restore/trash-restore.interface';
import type { TrashRow } from '../../models/trash-row/trash-row.interface';
import { TrashStore, type TrashStoreInstance } from './trash.store';

/**
 * Interface Deferred
 *
 * @description
 * A promise settled by the test.
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
   * Fulfils it.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;

  /**
   * Property reject
   *
   * @description
   * Rejects it.
   *
   * @type {(error: unknown) => void}
   * @readonly
   */
  readonly reject: (error: unknown) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * Creates a promise the test settles.
 *
 * @returns {Deferred<T>} The promise and its settlers.
 */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise: Promise<T> = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/**
 * Function entry
 *
 * @description
 * A trash entry of Atelier Nord's `Sprint 14`, deleted by Camille Martin.
 *
 * @param {Partial<TrashEntry>} overrides - Fields to change.
 * @returns {TrashEntry} The entry.
 */
function entry(overrides: Partial<TrashEntry> = {}): TrashEntry {
  return {
    id: 'entry-452',
    taskKey: 'CAD-452',
    taskName: 'Old sign-in screen',
    status: 'cancelled',
    parentKey: null,
    subtaskCount: 0,
    listName: 'Sprint 14',
    listDeleted: false,
    trashedAt: '2026-11-06T10:00:00Z',
    trashedBy: { kind: 'user', id: 'user-camille' },
    purgeAt: '2026-12-06T10:00:00Z',
    ...overrides,
  };
}

/**
 * Constant SECOND
 *
 * @description
 * A second entry, deleted by Hugo Durand.
 *
 * @type {TrashEntry}
 */
const SECOND: TrashEntry = entry({
  id: 'entry-447',
  taskKey: 'CAD-447',
  taskName: 'Dashboard PDF export (prototype)',
  status: 'todo',
  listName: 'Backlog',
  trashedBy: { kind: 'user', id: 'user-hugo' },
});

/**
 * Constant RESTORED
 *
 * @description
 * What restoring `CAD-452` brings back.
 *
 * @type {TrashRestore}
 */
const RESTORED: TrashRestore = {
  taskKey: 'CAD-452',
  taskName: 'Old sign-in screen',
  status: 'cancelled',
  listName: 'Sprint 14',
  subtaskCount: 2,
  detached: false,
};

/**
 * Function problem
 *
 * @description
 * A gateway failure with a problem body.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The failure.
 */
function problem(status: number, code: string = 'request.failed'): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, title: 'Failed' } });
}

describe('TrashStore', () => {
  let api: {
    entries: Mock<(options?: { passive?: boolean }) => Promise<readonly TrashEntry[]>>;
    members: Mock<() => Promise<ReadonlyMap<string, string>>>;
    restore: Mock<(entryId: string) => Promise<TrashRestore>>;
    purge: Mock<(entryId: string) => Promise<void>>;
    empty: Mock<() => Promise<number>>;
  };
  let navigation: { refresh: Mock<() => void>; refreshCounts: Mock<() => void> };
  let success: MockInstance<CwToastService['success']>;
  let info: MockInstance<CwToastService['info']>;
  let error: MockInstance<CwToastService['error']>;
  let pin: OrganizationPin;

  beforeEach(() => {
    api = {
      entries: vi.fn(() => Promise.resolve<readonly TrashEntry[]>([entry(), SECOND])),
      members: vi.fn(() =>
        Promise.resolve<ReadonlyMap<string, string>>(
          new Map([
            ['user-camille', 'Camille Martin'],
            ['user-hugo', 'Hugo Durand'],
          ]),
        ),
      ),
      restore: vi.fn(() => Promise.resolve(RESTORED)),
      purge: vi.fn(() => Promise.resolve()),
      empty: vi.fn(() => Promise.resolve(2)),
    };
    navigation = { refresh: vi.fn(), refreshCounts: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        TrashStore,
        { provide: TrashApi, useValue: api },
        { provide: NAVIGATION_REFRESH, useValue: navigation },
      ],
    });
    pin = TestBed.inject(OrganizationPin);
    pin.set('org-atelier-nord');
    const toasts: CwToastService = TestBed.inject(CwToastService);
    success = vi.spyOn(toasts, 'success');
    info = vi.spyOn(toasts, 'info');
    error = vi.spyOn(toasts, 'error');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Function loaded
   *
   * @description
   * Creates the store and waits for its first read and the member directory.
   *
   * @returns {Promise<TrashStoreInstance>} The store.
   */
  async function loaded(): Promise<TrashStoreInstance> {
    const store: TrashStoreInstance = TestBed.inject(TrashStore);
    await expect
      .poll(() => {
        TestBed.tick();
        return store.loading() || store.rows().some((row: TrashRow) => row.deletedBy === null);
      })
      .toBe(false);
    return store;
  }

  /**
   * Function keys
   *
   * @description
   * The task keys of the rows shown.
   *
   * @param {TrashStoreInstance} store - The store.
   * @returns {readonly string[]} The keys.
   */
  function keys(store: TrashStoreInstance): readonly string[] {
    return store.rows().map((row: TrashRow) => row.entry.taskKey);
  }

  it('shows the entries with who deleted them', async () => {
    api.entries.mockResolvedValue([
      entry(),
      entry({ id: 'e2', taskKey: 'CAD-2', trashedBy: { kind: 'user', id: 'user-gone' } }),
      entry({ id: 'e3', taskKey: 'CAD-3', trashedBy: { kind: 'automation', id: 'rule-1' } }),
      entry({ id: 'e4', taskKey: 'CAD-4', trashedBy: { kind: 'other', id: 'task-service' } }),
    ]);
    const store: TrashStoreInstance = TestBed.inject(TrashStore);
    await expect
      .poll(() => {
        TestBed.tick();
        return store.rows()[0]?.deletedBy;
      })
      .toBe('Camille Martin');

    expect(store.count()).toBe(4);
    expect(store.rows().map((row: TrashRow) => row.deletedBy)).toEqual([
      'Camille Martin',
      'Former member',
      'An automation',
      null,
    ]);
  });

  it('leaves the names out when the member directory cannot be read', async () => {
    api.members.mockRejectedValue(problem(403, 'members.read-forbidden'));
    const store: TrashStoreInstance = TestBed.inject(TrashStore);
    await expect
      .poll(() => {
        TestBed.tick();
        return store.loading();
      })
      .toBe(false);
    await expect
      .poll(() => {
        TestBed.tick();
        return api.members.mock.calls.length;
      })
      .toBe(1);

    expect(store.rows().map((row: TrashRow) => row.deletedBy)).toEqual([null, null]);
  });

  it('tells a completed empty trash from a failed read', async () => {
    api.entries.mockResolvedValueOnce([]);
    const empty: TrashStoreInstance = await loaded();
    expect(empty.count()).toBe(0);
    expect(empty.rows()).toEqual([]);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), TrashStore, { provide: TrashApi, useValue: api }],
    });
    TestBed.inject(OrganizationPin).set('org-atelier-nord');
    api.entries.mockRejectedValueOnce(problem(503));
    const failed: TrashStoreInstance = TestBed.inject(TrashStore);
    await expect
      .poll(() => {
        TestBed.tick();
        try {
          failed.loading();
          return 'read';
        } catch {
          return 'failed';
        }
      })
      .toBe('failed');
  });

  it('restores an entry, toasts it with Open and refreshes the sidebar', async () => {
    const store: TrashStoreInstance = await loaded();
    api.entries.mockResolvedValue([SECOND]);

    await store.restore(entry());

    expect(api.restore).toHaveBeenCalledWith('entry-452');
    expect(keys(store)).toEqual(['CAD-447']);
    const [title, options]: Parameters<CwToastService['success']> = success.mock.calls[0] ?? [''];
    expect(title).toBe('CAD-452 restored');
    expect(options?.description).toBe('With 2 subtasks, back in Sprint 14.');
    expect(options?.action?.label).toBe('Open');
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(api.entries).toHaveBeenCalledTimes(2);
  });

  it('sends one restore per entry while it is in flight', async () => {
    const store: TrashStoreInstance = await loaded();
    const answer: Deferred<TrashRestore> = deferred<TrashRestore>();
    api.restore.mockReturnValueOnce(answer.promise);

    const first: Promise<void> = store.restore(entry());
    await store.restore(entry());
    expect(store.rows()[0]?.pending).toBe('restore');
    expect(store.writing()).toBe(true);
    answer.resolve(RESTORED);
    await first;

    expect(api.restore).toHaveBeenCalledTimes(1);
    expect(store.writing()).toBe(false);
  });

  it('says Already restored for an entry no longer in the trash', async () => {
    const store: TrashStoreInstance = await loaded();
    api.restore.mockRejectedValueOnce(problem(404, 'trash-entry.not-found'));

    await store.restore(entry());

    expect(info).toHaveBeenCalledWith('Already restored');
    expect(keys(store)).toEqual(['CAD-447']);
    expect(api.entries).toHaveBeenCalledTimes(2);
  });

  it('keeps a refused entry and lets the person try again', async () => {
    const store: TrashStoreInstance = await loaded();
    api.restore.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));

    await store.restore(entry());

    expect(error).toHaveBeenCalledWith('Could not restore CAD-452');
    expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
    expect(store.rows()[0]?.pending).toBeNull();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it('reads the trash again after a restore without an answer, and trusts that read', async () => {
    const store: TrashStoreInstance = await loaded();
    api.restore.mockRejectedValueOnce(problem(503));
    api.entries.mockResolvedValueOnce([SECOND]);

    await store.restore(entry());

    expect(error).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith(
      'CAD-452 restored',
      expect.objectContaining({ description: 'Back in Sprint 14.' }),
    );
    expect(keys(store)).toEqual(['CAD-447']);
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it('reports a restore without an answer as not applied when the entry is still listed', async () => {
    const store: TrashStoreInstance = await loaded();
    api.restore.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    await store.restore(entry());

    expect(api.entries).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith('Could not restore CAD-452');
    expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
  });

  it('says it could not confirm when the trash cannot be read after a lost answer', async () => {
    const store: TrashStoreInstance = await loaded();
    api.restore.mockRejectedValueOnce(problem(504));
    api.entries.mockRejectedValueOnce(problem(503));

    await store.restore(entry());

    expect(error).toHaveBeenCalledWith('Could not confirm the change', {
      description: 'Check the trash again in a moment.',
    });
    expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
    expect(store.writing()).toBe(false);
  });

  it('never shows again a restored entry that an older read still lists', async () => {
    const store: TrashStoreInstance = await loaded();
    const older: Deferred<readonly TrashEntry[]> = deferred<readonly TrashEntry[]>();
    api.entries.mockReturnValueOnce(older.promise);
    window.dispatchEvent(new Event('focus'));
    expect(api.entries).toHaveBeenLastCalledWith({ passive: true });
    api.entries.mockResolvedValueOnce([SECOND]);

    await store.restore(entry());
    older.resolve([entry(), SECOND]);
    await older.promise;
    await Promise.resolve();

    expect(keys(store)).toEqual(['CAD-447']);
  });

  it('drops the answer of a write that began in another organization', async () => {
    const store: TrashStoreInstance = await loaded();
    const answer: Deferred<TrashRestore> = deferred<TrashRestore>();
    api.restore.mockReturnValueOnce(answer.promise);

    const restoring: Promise<void> = store.restore(entry());
    pin.set('org-other');
    answer.resolve(RESTORED);
    await restoring;

    expect(success).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(store.writing()).toBe(false);
  });

  it('erases an entry for good and refreshes the sidebar counts', async () => {
    const store: TrashStoreInstance = await loaded();
    api.entries.mockResolvedValue([SECOND]);

    await store.purge(entry());

    expect(api.purge).toHaveBeenCalledWith('entry-452');
    expect(success).toHaveBeenCalledWith('CAD-452 erased', {
      description: 'Deleted for good.',
    });
    expect(navigation.refreshCounts).toHaveBeenCalledTimes(1);
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(keys(store)).toEqual(['CAD-447']);
  });

  it('hides an entry a purge finds already gone', async () => {
    const store: TrashStoreInstance = await loaded();
    api.purge.mockRejectedValueOnce(problem(404, 'trash-entry.not-found'));

    await store.purge(entry());

    expect(info).toHaveBeenCalledWith('CAD-452 is no longer in the trash');
    expect(keys(store)).toEqual(['CAD-447']);
    expect(navigation.refreshCounts).toHaveBeenCalledTimes(1);
  });

  it('empties the trash, even over an older read in flight', async () => {
    const store: TrashStoreInstance = await loaded();
    const older: Deferred<readonly TrashEntry[]> = deferred<readonly TrashEntry[]>();
    api.entries.mockReturnValueOnce(older.promise);
    window.dispatchEvent(new Event('focus'));
    api.entries.mockResolvedValueOnce([]);

    await store.empty();
    older.resolve([entry(), SECOND, entry({ id: 'e9', taskKey: 'CAD-9' })]);
    await older.promise;
    await Promise.resolve();

    expect(store.rows()).toEqual([]);
    expect(success).toHaveBeenCalledWith('Trash emptied', {
      description: '2 items erased for good.',
    });
    expect(navigation.refreshCounts).toHaveBeenCalledTimes(1);
  });

  it('waits for the writes in flight before emptying', async () => {
    const store: TrashStoreInstance = await loaded();
    const answer: Deferred<TrashRestore> = deferred<TrashRestore>();
    api.restore.mockReturnValueOnce(answer.promise);

    const restoring: Promise<void> = store.restore(entry());
    await store.empty();
    answer.resolve(RESTORED);
    await restoring;

    expect(api.empty).not.toHaveBeenCalled();
  });

  it('reports a refused emptying and keeps the entries', async () => {
    const store: TrashStoreInstance = await loaded();
    api.empty.mockRejectedValueOnce(problem(403));

    await store.empty();

    expect(error).toHaveBeenCalledWith('Could not empty the trash');
    expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
    expect(store.emptying()).toBe(false);
  });
});
