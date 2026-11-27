import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type {
  DocumentCreateOutcome,
  DocumentRow,
  DocumentSummary,
} from '../../models/document/document.interface';
import { DocsStore } from './docs.store';

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

describe('DocsStore', () => {
  let api: { list: Mock; authors: Mock; create: Mock; remove: Mock; get: Mock };
  let toasts: { success: Mock; error: Mock; warning: Mock };

  beforeEach(() => {
    organization.set(ATELIER_NORD);
    spaces.set([
      { id: 's1', name: 'Product', icon: null, tone: '', callerRole: 'edit' },
      { id: 's2', name: 'Operations', icon: null, tone: '', callerRole: 'view' },
    ]);
    api = {
      list: vi.fn(() =>
        Promise.resolve([
          summary('d1', 'Release notes 3.1', 's1'),
          summary('d2', 'API integration guide', 's2'),
        ]),
      ),
      authors: vi.fn(() => Promise.resolve(new Map([['u2', 'Inès Roux']]))),
      create: vi.fn(() => Promise.resolve({ ...summary('d9', 'Untitled', 's1'), body: '' })),
      remove: vi.fn(() => Promise.resolve()),
      get: vi.fn(),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
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
    expect(api.list).toHaveBeenCalledWith('', expect.anything());
  });

  it('keeps the rows shown while another search is read, then shows its answer', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    let answer: (items: readonly DocumentSummary[]) => void = (): void => undefined;
    api.list.mockImplementationOnce(
      () =>
        new Promise<readonly DocumentSummary[]>((resolve) => {
          answer = resolve;
        }),
    );

    store.followQuery('  notes  ');
    TestBed.tick();

    expect(store.query()).toBe('notes');
    expect(store.rows()).toHaveLength(2);
    expect(store.searching()).toBe(true);
    answer([summary('d1', 'Release notes 3.1', 's1')]);
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
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls[0]).toEqual(['s1', 'Untitled', expect.any(String)]);
    expect(api.create.mock.calls[1]).toEqual(api.create.mock.calls[0]);
  });

  it('warns when no answer confirmed a creation, and keeps its key for the next one', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.create.mockRejectedValue(problem(503, 'upstream.unavailable'));

    expect(await store.create()).toEqual({ kind: 'unknown' });
    expect(toasts.warning).toHaveBeenCalledWith(
      'The document may not have been created',
      expect.anything(),
    );
    api.create.mockResolvedValue({ ...summary('d9', 'Untitled', 's1'), body: '' });
    await store.create();

    const keys: string[] = (api.create.mock.calls as [string, string, string][]).map(
      ([, , key]: [string, string, string]): string => key,
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('reports a refused creation and offers none without an editable space', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.create.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));

    expect(await store.create()).toEqual({ kind: 'failed' });
    expect(toasts.error).toHaveBeenCalledWith('The document could not be created', {
      description: 'You can no longer edit the documents of this space.',
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

  it('reads the document again after a lost deletion answer instead of failing', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const [first, second]: [DocumentRow, DocumentRow] = shownRows(store);
    api.remove.mockRejectedValue(new HttpErrorResponse({ status: 504 }));
    api.get.mockRejectedValueOnce(problem(404, 'document.not-found'));
    api.get.mockResolvedValueOnce({ ...second.document, body: '' });

    expect(await store.remove(first)).toBe('deleted');
    expect(await store.remove(second)).toBe('failed');

    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d2']);
    expect(toasts.error).toHaveBeenCalledWith('The document could not be deleted', {
      description: 'It is still there. Try again in a moment.',
    });
  });

  it('keeps a document that changed since it was shown', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    const [first]: [DocumentRow, DocumentRow] = shownRows(store);
    api.remove.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));

    expect(await store.remove(first)).toBe('conflict');
    await settle();

    expect(store.rows()).toHaveLength(2);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('refreshes in the background and keeps the rows when that read fails', async () => {
    const store: InstanceType<typeof DocsStore> = await loaded();
    api.list.mockResolvedValueOnce([summary('d3', 'Quota specification', 's1')]);

    await store.refresh();
    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d3']);
    expect(api.list).toHaveBeenLastCalledWith('', { passive: true });

    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    await store.refresh();
    expect(store.rows()?.map((row: DocumentRow) => row.document.id)).toEqual(['d3']);
  });
});
