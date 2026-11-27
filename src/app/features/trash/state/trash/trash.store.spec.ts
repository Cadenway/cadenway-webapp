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

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';

import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';
import { TaskDetailOpener } from '@features/task';

import { TrashApi } from '../../data-access/services/trash-api/trash-api.service';
import type { TrashEntry } from '../../models/trash-entry/trash-entry.interface';
import type { TrashListing } from '../../models/trash-listing/trash-listing.interface';
import type { TrashRestore } from '../../models/trash-restore/trash-restore.interface';
import type { TrashRow } from '../../models/trash-row/trash-row.interface';
import { TRASH_RECONCILE_DELAYS } from './trash-reconcile-delays.token';
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
 * A second entry, deleted earlier by Hugo Durand.
 *
 * @type {TrashEntry}
 */
const SECOND: TrashEntry = entry({
  id: 'entry-447',
  taskKey: 'CAD-447',
  taskName: 'Dashboard PDF export (prototype)',
  status: 'todo',
  listName: 'Backlog',
  trashedAt: '2026-10-27T10:00:00Z',
  trashedBy: { kind: 'user', id: 'user-hugo' },
});

/**
 * Function listing
 *
 * @description
 * A complete read of the trash.
 *
 * @param {readonly TrashEntry[]} entries - Its entries.
 * @param {number} total - Entries in the trash; the entry count by default.
 * @returns {TrashListing} The read.
 */
function listing(entries: readonly TrashEntry[], total: number = entries.length): TrashListing {
  return { entries, total };
}

/**
 * Constant BOTH
 *
 * @description
 * The trash with both entries.
 *
 * @type {TrashListing}
 */
const BOTH: TrashListing = listing([entry(), SECOND]);

/**
 * Constant ONLY_SECOND
 *
 * @description
 * The trash once `CAD-452` left it.
 *
 * @type {TrashListing}
 */
const ONLY_SECOND: TrashListing = listing([SECOND]);

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
    entries: Mock<(options?: { passive?: boolean; signal?: AbortSignal }) => Promise<TrashListing>>;
    members: Mock<() => Promise<ReadonlyMap<string, string>>>;
    restore: Mock<(entryId: string) => Promise<TrashRestore>>;
    purge: Mock<(entryId: string) => Promise<void>>;
    empty: Mock<() => Promise<number>>;
  };
  let navigation: { refresh: Mock<() => void>; refreshCounts: Mock<() => void> };
  let success: MockInstance<CwToastService['success']>;
  let info: MockInstance<CwToastService['info']>;
  let warning: MockInstance<CwToastService['warning']>;
  let error: MockInstance<CwToastService['error']>;
  let dismiss: MockInstance<CwToastService['dismiss']>;
  let pin: OrganizationPin;

  /**
   * Function configure
   *
   * @description
   * Provides the store with the fakes and pins Atelier Nord.
   */
  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        TrashStore,
        { provide: TrashApi, useValue: api },
        { provide: NAVIGATION_REFRESH, useValue: navigation },
        { provide: TRASH_RECONCILE_DELAYS, useValue: [0, 0, 0] },
      ],
    });
    pin = TestBed.inject(OrganizationPin);
    pin.set('org-atelier-nord');
    const toasts: CwToastService = TestBed.inject(CwToastService);
    success = vi.spyOn(toasts, 'success');
    info = vi.spyOn(toasts, 'info');
    warning = vi.spyOn(toasts, 'warning');
    error = vi.spyOn(toasts, 'error');
    dismiss = vi.spyOn(toasts, 'dismiss');
  }

  beforeEach(() => {
    api = {
      entries: vi.fn(() => Promise.resolve(BOTH)),
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
    configure();
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

  /**
   * Function flush
   *
   * @description
   * Lets the pending promises and zero-delay timers run.
   *
   * @returns {Promise<void>} Resolves once they ran.
   */
  async function flush(): Promise<void> {
    for (let turn: number = 0; turn < 5; turn += 1) {
      await new Promise<void>((resolve: () => void) => {
        setTimeout(resolve, 0);
      });
    }
  }

  describe('reads', () => {
    it('shows the entries with who deleted them', async () => {
      api.entries.mockResolvedValue(
        listing([
          entry(),
          entry({ id: 'e2', taskKey: 'CAD-2', trashedBy: { kind: 'user', id: 'user-gone' } }),
          entry({ id: 'e3', taskKey: 'CAD-3', trashedBy: { kind: 'automation', id: 'rule-1' } }),
          entry({ id: 'e4', taskKey: 'CAD-4', trashedBy: { kind: 'other', id: 'task-service' } }),
        ]),
      );
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
          return store.loading() || api.members.mock.calls.length === 0;
        })
        .toBe(false);
      await flush();

      expect(store.rows().map((row: TrashRow) => row.deletedBy)).toEqual([null, null]);
    });

    it('tells a completed empty trash from a failed read', async () => {
      api.entries.mockResolvedValueOnce(listing([]));
      const empty: TrashStoreInstance = await loaded();
      expect(empty.count()).toBe(0);
      expect(empty.rows()).toEqual([]);

      TestBed.resetTestingModule();
      configure();
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

    it('counts the entries past the cap of a read', async () => {
      api.entries.mockResolvedValue(listing([entry(), SECOND], 1_500));
      const store: TrashStoreInstance = await loaded();

      expect(store.rows()).toHaveLength(2);
      expect(store.count()).toBe(1_500);
      expect(store.hiddenCount()).toBe(1_498);
    });

    it('runs one background read at a time, with one more queued', async () => {
      await loaded();
      const first: Deferred<TrashListing> = deferred<TrashListing>();
      api.entries.mockReturnValueOnce(first.promise);

      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      expect(api.entries).toHaveBeenCalledTimes(2);
      expect(api.entries).toHaveBeenLastCalledWith(
        expect.objectContaining({ passive: true, signal: expect.any(AbortSignal) as AbortSignal }),
      );
      first.resolve(BOTH);
      await flush();

      expect(api.entries).toHaveBeenCalledTimes(3);
    });

    it('never shows again a restored entry that an older read still lists', async () => {
      const store: TrashStoreInstance = await loaded();
      const older: Deferred<TrashListing> = deferred<TrashListing>();
      api.entries.mockReturnValueOnce(older.promise);
      window.dispatchEvent(new Event('focus'));
      api.entries.mockResolvedValue(ONLY_SECOND);

      await store.restore(entry());
      older.resolve(BOTH);
      await flush();

      expect(keys(store)).toEqual(['CAD-447']);
    });
  });

  describe('restore', () => {
    it('restores an entry, toasts it with Open and refreshes the sidebar', async () => {
      const store: TrashStoreInstance = await loaded();
      const open: MockInstance<TaskDetailOpener['open']> = vi
        .spyOn(TestBed.inject(TaskDetailOpener), 'open')
        .mockResolvedValue(true);
      api.entries.mockResolvedValue(ONLY_SECOND);

      await store.restore(entry());

      expect(api.restore).toHaveBeenCalledWith('entry-452');
      expect(keys(store)).toEqual(['CAD-447']);
      const [title, options]: Parameters<CwToastService['success']> = success.mock.calls[0] ?? [''];
      expect(title).toBe('CAD-452 restored');
      expect(options?.description).toBe('With 2 subtasks, back in Sprint 14.');
      expect(options?.action?.label).toBe('Open');
      expect(navigation.refresh).toHaveBeenCalledTimes(1);
      options?.action?.run();
      expect(open).toHaveBeenCalledWith('CAD-452', expect.objectContaining({ key: 'CAD-452' }));
    });

    it('says when a restored task left its deleted parent', async () => {
      const store: TrashStoreInstance = await loaded();
      api.restore.mockResolvedValueOnce({ ...RESTORED, subtaskCount: 0, detached: true });

      await store.restore(entry());

      expect(success.mock.calls[0]?.[1]?.description).toBe(
        'Back in Sprint 14, detached from its deleted parent.',
      );
    });

    it('does not open the restored task from another organization', async () => {
      const store: TrashStoreInstance = await loaded();
      const open: MockInstance<TaskDetailOpener['open']> = vi
        .spyOn(TestBed.inject(TaskDetailOpener), 'open')
        .mockResolvedValue(true);
      await store.restore(entry());
      const run: (() => void) | undefined = success.mock.calls[0]?.[1]?.action?.run;

      pin.set('org-lumen');
      run?.();

      expect(open).not.toHaveBeenCalled();
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

    it('says Already restored on a 404 but lets the next read decide what shows', async () => {
      const store: TrashStoreInstance = await loaded();
      api.restore.mockRejectedValueOnce(problem(404, 'trash-entry.not-found'));

      await store.restore(entry());

      expect(info).toHaveBeenCalledWith('Already restored');
      expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
      expect(store.rows()[0]?.pending).toBeNull();

      api.restore.mockRejectedValueOnce(problem(404, 'trash-entry.not-found'));
      api.entries.mockResolvedValueOnce(ONLY_SECOND);
      await store.restore(entry());
      expect(keys(store)).toEqual(['CAD-447']);
    });

    it('asks to try again when the list is still being deleted', async () => {
      const store: TrashStoreInstance = await loaded();
      api.restore.mockRejectedValueOnce(problem(409, 'trash-entry.not-restorable-yet'));

      await store.restore(entry());

      expect(warning).toHaveBeenCalledWith('CAD-452 cannot be restored yet', {
        description: 'Its list is still being deleted. Try again in a moment.',
      });
      expect(info).not.toHaveBeenCalled();
      expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
      expect(store.rows()[0]?.pending).toBeNull();
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

    it('keeps the entry pending while delayed reads confirm a lost answer', async () => {
      const store: TrashStoreInstance = await loaded();
      const reread: Deferred<TrashListing> = deferred<TrashListing>();
      api.restore.mockRejectedValueOnce(problem(504));
      api.entries.mockReturnValueOnce(reread.promise).mockResolvedValueOnce(ONLY_SECOND);

      const restoring: Promise<void> = store.restore(entry());
      await flush();
      expect(store.rows()[0]?.pending).toBe('restore');
      await store.restore(entry());
      reread.resolve(BOTH);
      await restoring;

      expect(api.restore).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith('CAD-452 is no longer in the trash');
      expect(keys(store)).toEqual(['CAD-447']);
      expect(navigation.refresh).toHaveBeenCalledTimes(1);
    });

    it('frees an entry still listed after every delayed read, without calling it refused', async () => {
      const store: TrashStoreInstance = await loaded();
      api.restore.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

      await store.restore(entry());

      expect(api.entries).toHaveBeenCalledTimes(4);
      expect(error).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledWith('Could not confirm the change', {
        description: 'Check the trash again in a moment.',
      });
      expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
      expect(store.writing()).toBe(false);
    });

    it('says it could not confirm when the trash cannot be read after a lost answer', async () => {
      const store: TrashStoreInstance = await loaded();
      api.restore.mockRejectedValueOnce(problem(503));
      api.entries.mockRejectedValue(problem(503));

      await store.restore(entry());

      expect(warning).toHaveBeenCalledWith('Could not confirm the change', {
        description: 'Check the trash again in a moment.',
      });
      expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
    });

    it('drops a restore an organization switch blocked, without a read or a toast', async () => {
      const store: TrashStoreInstance = await loaded();
      api.restore.mockRejectedValueOnce(new OrganizationSwitchPendingError());

      await store.restore(entry());

      expect(api.entries).toHaveBeenCalledTimes(1);
      expect(success).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
      expect(warning).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(store.writing()).toBe(false);
    });

    it('drops the answer of a write that began in another organization', async () => {
      const store: TrashStoreInstance = await loaded();
      const answer: Deferred<TrashRestore> = deferred<TrashRestore>();
      api.restore.mockReturnValueOnce(answer.promise);

      const restoring: Promise<void> = store.restore(entry());
      pin.set('org-lumen');
      answer.resolve(RESTORED);
      await restoring;

      expect(success).not.toHaveBeenCalled();
      expect(navigation.refresh).not.toHaveBeenCalled();
      expect(store.writing()).toBe(false);
    });

    it('drops the answer after a switch to another organization and back', async () => {
      const store: TrashStoreInstance = await loaded();
      const answer: Deferred<TrashRestore> = deferred<TrashRestore>();
      api.restore.mockReturnValueOnce(answer.promise);
      const epoch: number = store.epoch();

      const restoring: Promise<void> = store.restore(entry());
      pin.set('org-lumen');
      pin.set('org-atelier-nord');
      answer.resolve(RESTORED);
      await restoring;

      expect(store.epoch()).toBe(epoch + 2);
      expect(success).not.toHaveBeenCalled();
      expect(navigation.refresh).not.toHaveBeenCalled();
      expect(store.writing()).toBe(false);
    });

    it('raises no toast once the page is gone, and dismisses its toasts', async () => {
      const store: TrashStoreInstance = await loaded();
      await store.restore(entry());
      const shown: string | undefined = success.mock.results[0]?.value as string | undefined;
      const answer: Deferred<TrashRestore> = deferred<TrashRestore>();
      api.restore.mockReturnValueOnce(answer.promise);

      const restoring: Promise<void> = store.restore(SECOND);
      TestBed.resetTestingModule();
      answer.resolve({ ...RESTORED, taskKey: 'CAD-447' });
      await restoring;

      expect(dismiss).toHaveBeenCalledWith(shown);
      expect(success).toHaveBeenCalledTimes(1);
    });

    it('dismisses its toasts on an organization change', async () => {
      const store: TrashStoreInstance = await loaded();
      await store.restore(entry());
      const shown: string | undefined = success.mock.results[0]?.value as string | undefined;

      pin.set('org-lumen');

      expect(dismiss).toHaveBeenCalledWith(shown);
    });
  });

  describe('purge', () => {
    it('erases an entry for good and refreshes the sidebar counts', async () => {
      const store: TrashStoreInstance = await loaded();
      api.entries.mockResolvedValue(ONLY_SECOND);

      await store.purge(entry(), store.epoch());

      expect(api.purge).toHaveBeenCalledWith('entry-452');
      expect(success).toHaveBeenCalledWith('CAD-452 erased', { description: 'Deleted for good.' });
      expect(navigation.refreshCounts).toHaveBeenCalledTimes(1);
      expect(navigation.refresh).not.toHaveBeenCalled();
      expect(keys(store)).toEqual(['CAD-447']);
    });

    it('does nothing for a confirmation from an earlier organization epoch', async () => {
      const store: TrashStoreInstance = await loaded();
      const epoch: number = store.epoch();
      pin.set('org-lumen');
      pin.set('org-atelier-nord');

      await store.purge(entry(), epoch);

      expect(api.purge).not.toHaveBeenCalled();
    });

    it('lets the next read decide after a purge finds its entry gone', async () => {
      const store: TrashStoreInstance = await loaded();
      api.purge.mockRejectedValueOnce(problem(404, 'trash-entry.not-found'));
      api.entries.mockResolvedValueOnce(ONLY_SECOND);

      await store.purge(entry(), store.epoch());

      expect(info).toHaveBeenCalledWith('CAD-452 is no longer in the trash');
      expect(keys(store)).toEqual(['CAD-447']);
      expect(navigation.refreshCounts).toHaveBeenCalledTimes(1);
    });

    it('keeps a refused entry', async () => {
      const store: TrashStoreInstance = await loaded();
      api.purge.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));

      await store.purge(entry(), store.epoch());

      expect(error).toHaveBeenCalledWith('Could not delete CAD-452 forever');
      expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
      expect(navigation.refreshCounts).not.toHaveBeenCalled();
    });

    it('confirms a purge without an answer once a delayed read no longer lists it', async () => {
      const store: TrashStoreInstance = await loaded();
      api.purge.mockRejectedValueOnce(problem(502));
      api.entries.mockResolvedValueOnce(BOTH).mockResolvedValueOnce(ONLY_SECOND);

      await store.purge(entry(), store.epoch());

      expect(info).toHaveBeenCalledWith('CAD-452 is no longer in the trash');
      expect(keys(store)).toEqual(['CAD-447']);
      expect(navigation.refreshCounts).toHaveBeenCalledTimes(1);
    });

    it('frees a purge without an answer that every delayed read still lists', async () => {
      const store: TrashStoreInstance = await loaded();
      api.purge.mockRejectedValueOnce(problem(502));

      await store.purge(entry(), store.epoch());

      expect(error).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledWith('Could not confirm the change', {
        description: 'Check the trash again in a moment.',
      });
      expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
      expect(store.writing()).toBe(false);
    });
  });

  describe('empty', () => {
    it('empties the trash, even over an older read in flight', async () => {
      const store: TrashStoreInstance = await loaded();
      const older: Deferred<TrashListing> = deferred<TrashListing>();
      api.entries.mockReturnValueOnce(older.promise);
      window.dispatchEvent(new Event('focus'));
      api.entries.mockResolvedValue(listing([]));

      await store.empty(store.epoch());
      older.resolve(listing([entry(), SECOND, entry({ id: 'e9', taskKey: 'CAD-9' })]));
      await flush();

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
      await store.empty(store.epoch());
      answer.resolve(RESTORED);
      await restoring;

      expect(api.empty).not.toHaveBeenCalled();
    });

    it('reports a refused emptying and keeps the entries', async () => {
      const store: TrashStoreInstance = await loaded();
      api.empty.mockRejectedValueOnce(problem(403));

      await store.empty(store.epoch());

      expect(error).toHaveBeenCalledWith('Could not empty the trash');
      expect(keys(store)).toEqual(['CAD-452', 'CAD-447']);
      expect(store.emptying()).toBe(false);
    });

    it('confirms an emptying without an answer once a delayed read lists none of the entries', async () => {
      const store: TrashStoreInstance = await loaded();
      api.empty.mockRejectedValueOnce(problem(504));
      api.entries.mockResolvedValueOnce(BOTH).mockResolvedValueOnce(listing([]));

      await store.empty(store.epoch());

      expect(success).toHaveBeenCalledWith('Trash emptied', {
        description: '2 items erased for good.',
      });
      expect(store.rows()).toEqual([]);
      expect(store.emptying()).toBe(false);
    });

    it('frees an emptying without an answer that every delayed read contradicts', async () => {
      const store: TrashStoreInstance = await loaded();
      api.empty.mockRejectedValueOnce(problem(504));

      await store.empty(store.epoch());

      expect(success).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledWith('Could not confirm the change', {
        description: 'Check the trash again in a moment.',
      });
      expect(store.emptying()).toBe(false);
    });

    it('needs an empty trash to confirm an emptying when no entry was shown', async () => {
      api.entries.mockResolvedValue(listing([], 3));
      const store: TrashStoreInstance = await loaded();
      api.empty.mockRejectedValueOnce(problem(503));

      await store.empty(store.epoch());
      expect(warning).toHaveBeenCalledWith('Could not confirm the change', {
        description: 'Check the trash again in a moment.',
      });

      api.empty.mockRejectedValueOnce(problem(503));
      api.entries.mockResolvedValue(listing([]));
      await store.empty(store.epoch());
      expect(success).toHaveBeenCalledWith('Trash emptied', {
        description: '0 items erased for good.',
      });
    });
  });
});
