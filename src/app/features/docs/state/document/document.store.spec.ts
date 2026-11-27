import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SPACE_DIRECTORY } from '@features/spaces/ports/space-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';
import { NotFoundRouteError } from '@shared/route-errors';

import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type { DocumentDetail, DocumentSaveOutcome } from '../../models/document/document.interface';
import { DocumentStore } from './document.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization the workspace shows.
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
 * Constant NOTES
 *
 * @description
 * The mockup's release notes (`App.dc.html` line 3835), at version 3.
 *
 * @type {DocumentDetail}
 */
const NOTES: DocumentDetail = {
  id: 'd1',
  spaceId: 's1',
  title: 'Release notes 3.1',
  authorUserId: 'u2',
  updatedAt: '2026-11-26T17:20:00Z',
  version: 3,
  body: '# Highlights',
};

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

describe('DocumentStore', () => {
  let api: { open: Mock; get: Mock; update: Mock; remove: Mock; authors: Mock };
  let toasts: { success: Mock; error: Mock; warning: Mock; info: Mock };

  beforeEach(() => {
    organization.set(ATELIER_NORD);
    api = {
      open: vi.fn((id: string) => Promise.resolve({ ...NOTES, id })),
      get: vi.fn(() => Promise.resolve(NOTES)),
      update: vi.fn((_id: string, version: number, draft: { title: string; body: string }) =>
        Promise.resolve({ ...NOTES, ...draft, version: version + 1, authorUserId: 'u1' }),
      ),
      remove: vi.fn(() => Promise.resolve()),
      authors: vi.fn(() =>
        Promise.resolve(
          new Map([
            ['u1', 'Camille Martin'],
            ['u2', 'Inès Roux'],
          ]),
        ),
      ),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    const workspace: Partial<WorkspaceContextPort> = { organization };
    TestBed.configureTestingModule({
      providers: [
        DocumentStore,
        { provide: DocumentsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        {
          provide: SPACE_DIRECTORY,
          useValue: {
            spaces: signal([
              { id: 's1', name: 'Product', icon: null, tone: '', callerRole: 'edit' },
            ]),
          },
        },
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
   * Creates the store on the release notes and waits for its reads.
   *
   * @returns {Promise<InstanceType<typeof DocumentStore>>} The store.
   */
  async function opened(): Promise<InstanceType<typeof DocumentStore>> {
    const store: InstanceType<typeof DocumentStore> = TestBed.inject(DocumentStore);
    store.followDocument('d1');
    await settle();
    return store;
  }

  /**
   * Function editing
   *
   * @description
   * Opens the release notes in edit mode.
   *
   * @returns {Promise<InstanceType<typeof DocumentStore>>} The store.
   */
  async function editing(): Promise<InstanceType<typeof DocumentStore>> {
    const store: InstanceType<typeof DocumentStore> = await opened();
    expect(store.beginEditing()?.version).toBe(3);
    return store;
  }

  it('reads the document with its space, rights and author', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();

    expect(store.current()?.title).toBe('Release notes 3.1');
    expect(store.space()?.name).toBe('Product');
    expect(store.canEdit()).toBe(true);
    expect(store.authorName()).toBe('Inès Roux');
    expect(api.open).toHaveBeenCalledWith('d1', expect.any(AbortSignal));
  });

  it('lets a missing document throw from current, for the route boundary', async () => {
    api.open.mockRejectedValueOnce(new NotFoundRouteError());
    const store: InstanceType<typeof DocumentStore> = await opened();

    expect(() => store.current()).toThrow();
  });

  it('saves only in edit mode, from its base version, an empty title saving as Untitled', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    expect(await store.save({ title: 'A', body: '' })).toEqual({ kind: 'cancelled' });

    store.beginEditing();
    expect(await store.save({ title: '   ', body: '- A' })).toEqual({ kind: 'saved' });

    expect(api.update).toHaveBeenCalledWith('d1', 3, { title: 'Untitled', body: '- A' });
    expect(store.current()).toEqual(
      expect.objectContaining({ title: 'Untitled', body: '- A', version: 4 }),
    );
    expect(toasts.success).toHaveBeenCalledWith('Document saved', { description: 'Untitled' });
    expect(await store.save({ title: 'B', body: '- A' })).toEqual({ kind: 'saved' });
    expect(api.update).toHaveBeenLastCalledWith('d1', 4, { title: 'B', body: '- A' });
  });

  it('cuts the title at 200 code points', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();

    await store.save({ title: '😀'.repeat(250), body: '' });

    expect(api.update).toHaveBeenCalledWith('d1', 3, { title: '😀'.repeat(200), body: '' });
  });

  it('applies no background read in edit mode, so a save keeps the version it started from', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    const store: InstanceType<typeof DocumentStore> = await opened();
    let answer: (fresh: DocumentDetail) => void = (): void => undefined;
    api.get.mockImplementationOnce(
      () =>
        new Promise<DocumentDetail>((resolve) => {
          answer = resolve;
        }),
    );
    vi.setSystemTime(new Date('2026-11-27T10:01:00Z'));

    const reading: Promise<void> = store.refresh();
    store.beginEditing();
    answer({ ...NOTES, body: '# Fixes', version: 5, authorUserId: 'u1' });
    await reading;
    await store.refresh(true);

    expect(store.current()?.version).toBe(3);
    expect(api.get).toHaveBeenCalledTimes(1);
    await store.save({ title: 'Release notes 3.1', body: '- A' });
    expect(api.update).toHaveBeenCalledWith('d1', 3, expect.anything());
  });

  it('merges another version saved first, field by field, and names who saved it', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    api.update.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce({
      ...NOTES,
      body: '# Fixes',
      version: 5,
      authorUserId: 'u1',
      updatedAt: '2026-11-27T09:40:00Z',
    });

    const outcome: DocumentSaveOutcome = await store.save({
      title: 'Release notes 3.2',
      body: NOTES.body,
    });

    expect(outcome).toEqual({
      kind: 'conflict',
      draft: { title: 'Release notes 3.2', body: '# Fixes' },
    });
    expect(store.current()?.version).toBe(5);
    expect(store.conflict()).toEqual({
      authorUserId: 'u1',
      updatedAt: '2026-11-27T09:40:00Z',
    });
    expect(store.conflictAuthorName()).toBe('Camille Martin');

    expect(await store.save({ title: 'Release notes 3.2', body: '# Fixes' })).toEqual({
      kind: 'saved',
    });
    expect(api.update).toHaveBeenLastCalledWith('d1', 5, {
      title: 'Release notes 3.2',
      body: '# Fixes',
    });
    expect(store.conflict()).toBeNull();
  });

  it('adopts another version saved first when the draft changed nothing', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    api.update.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce({ ...NOTES, body: '# Fixes', version: 5 });

    expect(await store.save({ title: NOTES.title, body: NOTES.body })).toEqual({
      kind: 'adopted',
    });
    expect(store.current()?.body).toBe('# Fixes');
    expect(store.conflict()).toBeNull();
  });

  it('reads again after a lost answer: saved when the draft is stored', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    api.update.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api.get.mockResolvedValueOnce({ ...NOTES, body: '- A', version: 4 });

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toEqual({
      kind: 'saved',
    });
    expect(store.current()?.version).toBe(4);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('reads again after a server error: failed when the version sent is still stored', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    api.update.mockRejectedValueOnce(problem(503, 'upstream.timeout'));

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toEqual({
      kind: 'failed',
    });
    expect(toasts.error).toHaveBeenCalledWith('The document could not be saved', {
      description: 'Your draft is kept. Try again in a moment.',
    });
  });

  it('warns when neither the save nor the read that follows it answered', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    api.update.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api.get.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toEqual({
      kind: 'unknown',
    });
    expect(toasts.warning).toHaveBeenCalledWith(
      'The document may not have been saved',
      expect.anything(),
    );
    expect(store.current()?.version).toBe(3);
  });

  it('says a deleted document is gone, and words a refused or invalid save', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    api.update.mockRejectedValueOnce(problem(404, 'document.not-found'));
    expect(await store.save({ title: 'A', body: '' })).toEqual({ kind: 'gone' });

    api.update.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));
    expect(await store.save({ title: 'A', body: '' })).toEqual({ kind: 'failed' });
    expect(toasts.error).toHaveBeenLastCalledWith('The document could not be saved', {
      description: 'You can no longer edit the documents of this space.',
    });

    api.update.mockRejectedValueOnce(problem(400, 'request.invalid'));
    expect(await store.save({ title: 'A', body: '' })).toEqual({ kind: 'failed' });
    expect(toasts.error).toHaveBeenLastCalledWith('The document could not be saved', {
      description: 'It was refused as invalid. Check the length of its title and its content.',
    });
  });

  it('sends nothing once the organization changed', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    api.update.mockImplementationOnce(() => {
      organization.set({ ...ATELIER_NORD, id: 'o2' });
      return Promise.resolve({ ...NOTES, version: 4 });
    });

    expect(await store.save({ title: 'A', body: '' })).toEqual({ kind: 'cancelled' });
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('drops a save that settles after another document is shown, without leaking saving', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    let answer: (saved: DocumentDetail) => void = (): void => undefined;
    api.update.mockImplementationOnce(
      () =>
        new Promise<DocumentDetail>((resolve) => {
          answer = resolve;
        }),
    );

    const saving: Promise<DocumentSaveOutcome> = store.save({ title: 'A', body: '' });
    expect(store.saving()).toBe(true);
    store.followDocument('d2');
    expect(store.saving()).toBe(false);
    expect(store.editing()).toBe(false);
    await settle();
    answer({ ...NOTES, title: 'A', version: 4 });

    expect(await saving).toEqual({ kind: 'cancelled' });
    expect(store.current()?.id).toBe('d2');
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('waits for a save under way', async () => {
    const store: InstanceType<typeof DocumentStore> = await editing();
    let answer: (saved: DocumentDetail) => void = (): void => undefined;
    api.update.mockImplementationOnce(
      () =>
        new Promise<DocumentDetail>((resolve) => {
          answer = resolve;
        }),
    );
    void store.save({ title: 'A', body: '' });
    let settled: boolean = false;
    const waiting: Promise<void> = store.saveSettled().then((): void => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    answer({ ...NOTES, title: 'A', version: 4 });
    await waiting;
    expect(store.saving()).toBe(false);
  });

  it('deletes from the version shown', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();

    expect(await store.remove()).toBe('deleted');
    expect(api.remove).toHaveBeenCalledWith('d1', 3);
  });

  it('drops a deletion whose document is no longer shown, without reading or a toast', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.remove.mockImplementationOnce(() => {
      store.followDocument('d2');
      return Promise.reject(new Error('The answer was lost.'));
    });

    expect(await store.remove()).toBe('cancelled');
    expect(api.get).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.warning).not.toHaveBeenCalled();
  });

  it('shows a newer version read in the background at most once per 30 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.get.mockResolvedValue({ ...NOTES, title: 'Release notes 3.2', version: 4 });

    await store.refresh();
    expect(api.get).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-11-27T10:00:31Z'));
    await store.refresh();
    expect(store.current()?.title).toBe('Release notes 3.2');
    expect(api.get).toHaveBeenLastCalledWith('d1', { passive: true });

    vi.setSystemTime(new Date('2026-11-27T10:01:02Z'));
    api.get.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    await store.refresh();
    expect(store.current()?.title).toBe('Release notes 3.2');
  });
});
