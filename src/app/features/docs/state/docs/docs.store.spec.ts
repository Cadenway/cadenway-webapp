import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type {
  DocumentCreateOutcome,
  DocumentDeleteOutcome,
  DocumentList,
  DocumentRow,
  DocumentSummary,
} from '../../models/document/document.interface';
import { DocsStore, IN_PROGRESS_DELAY_MS } from './docs.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization the workspace shows first.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o1',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'member',
  plan: 'team',
};

/**
 * Constant organization
 *
 * @description
 * The organization the workspace shows, switched by some specs.
 *
 * @type {WritableSignal<WorkspaceOrganization>}
 */
const organization: WritableSignal<WorkspaceOrganization> = signal(ATELIER_NORD);

/**
 * Constant spaces
 *
 * @description
 * The spaces of the sidebar: Product, which the caller edits, and Operations, which they view.
 *
 * @type {WritableSignal<readonly SpaceDirectoryEntry[]>}
 */
const spaces: WritableSignal<readonly SpaceDirectoryEntry[]> = signal([]);

/**
 * Function summary
 *
 * @description
 * A document of the mockup's catalog (`App.dc.html` lines 3834-3839).
 *
 * @param {string} id - Its id.
 * @param {string} title - Its title.
 * @param {string} spaceId - Its space.
 * @returns {DocumentSummary} The document.
 */
function summary(id: string, title: string, spaceId: string): DocumentSummary {
  return {
    id,
    spaceId,
    title,
    authorUserId: 'u2',
    updatedAt: '2026-11-26T17:20:00Z',
    version: 2,
  };
}

/**
 * Function listOf
 *
 * @description
 * A complete read of the catalog.
 *
 * @param {readonly DocumentSummary[]} items - The documents.
 * @returns {DocumentList} The read.
 */
function listOf(...items: readonly DocumentSummary[]): DocumentList {
  return { items, truncated: false };
}

/**
 * Function problem
 *
 * @description
 * A gateway answer with a status and a problem code.
 *
 * @param {number} status - The status.
 * @param {string} code - The problem code.
 * @returns {HttpErrorResponse} The failure.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { status, code } });
}

/**
 * Function settle
 *
 * @description
 * Waits until the application is stable.
 *
 * @returns {Promise<void>} Resolves once stable.
 */
async function settle(): Promise<void> {
  await TestBed.inject(ApplicationRef).whenStable();
}

/**
 * Function shownRows
 *
 * @description
 * The two rows the catalog shows first.
 *
 * @param {InstanceType<typeof DocsStore>} store - The store.
 * @returns {[DocumentRow, DocumentRow]} The rows.
 */
function shownRows(store: InstanceType<typeof DocsStore>): [DocumentRow, DocumentRow] {
  const rows: readonly DocumentRow[] = store.rows() ?? [];
  const first: DocumentRow | undefined = rows.at(0);
  const second: DocumentRow | undefined = rows.at(1);
  if (first === undefined || second === undefined) throw new Error('Expected two rows.');
  return [first, second];
}

/**
 * Function keysOf
 *
 * @description
 * The idempotency keys the creations were sent with.
 *
 * @param {Mock} create - The faked creation.
 * @returns {string[]} The keys, in order.
 */
function keysOf(create: Mock): string[] {
  return (create.mock.calls as [string, string, string][]).map(
    ([, , key]: [string, string, string]): string => key,
  );
}

describe('DocsStore', () => {
  let api: { list: Mock; authors: Mock; create: Mock; remove: Mock; get: Mock };
  let toasts: { success: Mock; error: Mock; warning: Mock; info: Mock };

  beforeEach(() => {
    organization.set(ATELIER_NORD);
    spaces.set([
      { id: 's1', name: 'Product', icon: null, tone: '', callerRole: 'edit' },
      { id: 's2', name: 'Operations', icon: null, tone: '', callerRole: 'view' },
    ]);
    api = {
      list: vi.fn(() =>
        Promise.resolve(
          listOf(
            summary('d1', 'Release notes 3.1', 's1'),
            summary('d2', 'API integration guide', 's2'),
          ),
        ),
      ),
      authors: vi.fn(() => Promise.resolve(new Map([['u2', 'Inès Roux']]))),
      create: vi.fn(() => Promise.resolve({ ...summary('d9', 'Untitled', 's1'), body: '' })),
      remove: vi.fn(() => Promise.resolve()),
      get: vi.fn(),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    const workspace: Partial<WorkspaceContextPort> = { organization };
    TestBed.configureTestingModule({
      providers: [
        DocsStore,
        { provide: DocumentsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: SPACE_DIRECTORY, useValue: { spaces } },
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
   * Creates the store and waits for its first reads.
   *
   * @returns {Promise<InstanceType<typeof DocsStore>>} The store.
   */
  async function loaded(): Promise<InstanceType<typeof DocsStore>> {
    const store: InstanceType<typeof DocsStore> = TestBed.inject(DocsStore);
    await settle();
    return store;
  }

  it('names each row’s space and author and decides its rights from the space role', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();

    expect(
      store
        .rows()
        ?.map((row: DocumentRow) => [
          row.document.title,
          row.spaceName,
          row.authorName,
          row.canEdit,
        ]),
    ).toEqual([
      ['Release notes 3.1', 'Product', 'Inès Roux', true],
      ['API integration guide', 'Operations', 'Inès Roux', false],
    ]);
    expect(store.targetSpace()?.id).toBe('s1');
    expect(store.truncated()).toBe(false);
    expect(api.list).toHaveBeenCalledWith('', expect.anything());
  });

  it('says when more documents match than the catalog reads', async () => {
    api.list.mockResolvedValueOnce({
      items: [summary('d1', 'Release notes 3.1', 's1')],
      truncated: true,
    });
    const store: InstanceType<typeof DocsStore> = await loaded();

    expect(store.truncated()).toBe(true);
  });

  it('keeps the rows shown while another search is read, then shows its answer', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    let answer: (list: DocumentList) => void = (): void => undefined;
    api.list.mockImplementationOnce(
      () =>
        new Promise<DocumentList>((resolve) => {
          answer = resolve;
        }),
    );

    store.followQuery('  notes  ');
    TestBed.tick();

    expect(store.query()).toBe('notes');
    expect(store.rows()).toHaveLength(2);
    expect(store.searching()).toBe(true);
    answer(listOf(summary('d1', 'Release notes 3.1', 's1')));
    await settle();
    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d1']);
    expect(store.searching()).toBe(false);
  });

  it('lets a failed read throw from rows, for the route boundary', async () => {
    api.list.mockRejectedValueOnce(problem(503, 'upstream.timeout'));
    const store: InstanceType<typeof DocsStore> = await loaded();

    expect(() => store.rows()).toThrow();
  });

  it('keeps the names unknown when the member directory cannot be read', async () => {
    api.authors.mockRejectedValueOnce(problem(403, 'members.read-forbidden'));
    const store: InstanceType<typeof DocsStore> = await loaded();

    expect(store.rows()?.[0]?.authorName).toBeNull();
  });

  it('creates in the first editable space, replaying a lost answer with the same key', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.create.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    const outcome: DocumentCreateOutcome = await store.create();

    expect(outcome).toEqual({ kind: 'created', id: 'd9' });
    expect(api.create.mock.calls[0]).toEqual(['s1', 'Untitled', expect.any(String)]);
    expect(api.create.mock.calls[1]).toEqual(api.create.mock.calls[0]);
  });

  it('sends again after a pause a creation the gateway still runs', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    vi.useFakeTimers();
    api.create.mockRejectedValueOnce(problem(409, 'idempotency.request-in-progress'));

    const creation: Promise<DocumentCreateOutcome> = store.create();
    await vi.advanceTimersByTimeAsync(IN_PROGRESS_DELAY_MS - 1);
    expect(api.create).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(await creation).toEqual({ kind: 'created', id: 'd9' });
    expect(new Set(keysOf(api.create)).size).toBe(1);
  });

  it('sends once with a new key a replay whose document was deleted since', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.create.mockRejectedValueOnce(problem(404, 'document.not-found'));

    expect(await store.create()).toEqual({ kind: 'created', id: 'd9' });

    const keys: string[] = keysOf(api.create);
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('warns when no answer confirmed a creation, and keeps its key for the next one', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.create.mockRejectedValue(problem(503, 'upstream.unavailable'));

    expect(await store.create()).toEqual({ kind: 'unknown' });
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(toasts.warning).toHaveBeenCalledWith(
      'The document may not have been created',
      expect.anything(),
    );
    api.create.mockResolvedValue({ ...summary('d9', 'Untitled', 's1'), body: '' });
    await store.create();

    expect(new Set(keysOf(api.create)).size).toBe(1);
  });

  it('reports a refused creation and offers none without an editable space', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.create.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));

    expect(await store.create()).toEqual({ kind: 'failed' });
    expect(toasts.error).toHaveBeenCalledWith('The document could not be created', {
      description: 'You can no longer edit the documents of this space.',
    });

    api.create.mockRejectedValueOnce(problem(400, 'request.invalid'));
    expect(await store.create()).toEqual({ kind: 'failed' });
    expect(toasts.error).toHaveBeenLastCalledWith('The document could not be created', {
      description: 'It was refused as invalid. Check the length of its title and its content.',
    });

    spaces.set([{ id: 's2', name: 'Operations', icon: null, tone: '', callerRole: 'view' }]);
    expect(store.targetSpace()).toBeNull();
    expect(await store.create()).toEqual({ kind: 'cancelled' });
  });

  it('drops a creation whose organization changed before its answer', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.create.mockImplementationOnce(() => {
      organization.set({ ...ATELIER_NORD, id: 'o2', slug: 'studio-sud' });
      return Promise.resolve({ ...summary('d9', 'Untitled', 's1'), body: '' });
    });

    expect(await store.create()).toEqual({ kind: 'cancelled' });
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('hides a deleted row, and counts a document already gone as deleted', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const [first, second]: [DocumentRow, DocumentRow] = shownRows(store);

    expect(await store.remove(first)).toBe('deleted');
    api.remove.mockRejectedValueOnce(problem(404, 'document.not-found'));
    expect(await store.remove(second)).toBe('deleted');

    expect(store.rows()).toEqual([]);
    expect(api.remove).toHaveBeenCalledWith('d1', 2);
    expect(toasts.success).toHaveBeenCalledWith('Document deleted', {
      description: 'Release notes 3.1',
    });
  });

  it('does not count another 404 as a deleted document', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const [first]: [DocumentRow, DocumentRow] = shownRows(store);
    api.remove.mockRejectedValueOnce(problem(404, 'organization.not-found'));

    expect(await store.remove(first)).toBe('failed');
    expect(store.rows()).toHaveLength(2);
  });

  it('keeps a timed-out deletion pending until a delayed read finds the document gone', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const [first]: [DocumentRow, DocumentRow] = shownRows(store);
    vi.useFakeTimers();
    api.remove.mockRejectedValueOnce(new HttpErrorResponse({ status: 504 }));
    // The first check still finds it: the original request completes only afterwards.
    api.get.mockResolvedValueOnce({ ...first.document, body: '' });
    api.get.mockRejectedValueOnce(problem(404, 'document.not-found'));

    const removal: Promise<DocumentDeleteOutcome> = store.remove(first);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(api.get).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(store.deletingId()).toBe('d1');
    expect(toasts.error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_000);

    expect(await removal).toBe('deleted');
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(store.deletingId()).toBeNull();
    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d2']);
    expect(toasts.success).toHaveBeenCalledWith('Document deleted', {
      description: 'Release notes 3.1',
    });
  });

  it('says a deletion could not be confirmed, never failed, when every check finds it', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const [first]: [DocumentRow, DocumentRow] = shownRows(store);
    vi.useFakeTimers();
    api.remove.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api.get.mockResolvedValue({ ...first.document, body: '' });

    const removal: Promise<DocumentDeleteOutcome> = store.remove(first);
    await vi.advanceTimersByTimeAsync(14_000);

    expect(await removal).toBe('unknown');
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.warning).toHaveBeenCalledWith('The deletion could not be confirmed', {
      description:
        'The answer was lost and the document may still disappear. Check the list in a moment before deleting it again.',
    });
  });

  it('keeps a document that changed since it was shown, and reads the catalog again', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const [first]: [DocumentRow, DocumentRow] = shownRows(store);
    api.remove.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));

    expect(await store.remove(first)).toBe('conflict');
    await settle();

    expect(store.rows()).toHaveLength(2);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('refreshes in the background at most once per 30 s, keeping the rows when it fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.list.mockResolvedValue(listOf(summary('d3', 'Quota specification', 's1')));

    await store.refresh();
    expect(api.list).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-11-27T10:00:31Z'));
    await store.refresh();
    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d3']);
    expect(api.list).toHaveBeenLastCalledWith('', { passive: true });

    vi.setSystemTime(new Date('2026-11-27T10:01:02Z'));
    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    await store.refresh();
    expect(api.list).toHaveBeenCalledTimes(3);
    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d3']);
  });

  it('applies only the last background read issued when two overlap', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const answers: ((list: DocumentList) => void)[] = [];
    api.list.mockImplementation(
      () =>
        new Promise<DocumentList>((resolve) => {
          answers.push(resolve);
        }),
    );

    const older: Promise<void> = store.refresh(true);
    const newer: Promise<void> = store.refresh(true);
    answers[1]?.(listOf(summary('d4', 'Sprint 14 review', 's1')));
    await newer;
    answers[0]?.(listOf(summary('d3', 'Quota specification', 's1')));
    await older;

    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d4']);
  });
});
