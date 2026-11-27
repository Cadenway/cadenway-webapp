import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SPACE_DIRECTORY } from '@features/spaces/ports/space-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';
import { NotFoundRouteError } from '@shared/route-errors';

import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type { DocumentDetail } from '../../models/document/document.interface';
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
  let toasts: { success: Mock; error: Mock; warning: Mock };

  beforeEach(() => {
    organization.set(ATELIER_NORD);
    api = {
      open: vi.fn(() => Promise.resolve(NOTES)),
      get: vi.fn(() => Promise.resolve(NOTES)),
      update: vi.fn((_id: string, version: number, draft: { title: string; body: string }) =>
        Promise.resolve({ ...NOTES, ...draft, version: version + 1 }),
      ),
      remove: vi.fn(() => Promise.resolve()),
      authors: vi.fn(() => Promise.resolve(new Map([['u2', 'Inès Roux']]))),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
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

  it('saves from the version shown, an empty title saving as Untitled', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();

    expect(await store.save({ title: '   ', body: '- A' })).toBe('saved');

    expect(api.update).toHaveBeenCalledWith('d1', 3, { title: 'Untitled', body: '- A' });
    expect(store.current()).toEqual(
      expect.objectContaining({ title: 'Untitled', body: '- A', version: 4 }),
    );
    expect(toasts.success).toHaveBeenCalledWith('Document saved', { description: 'Untitled' });
  });

  it('keeps the draft over another version saved first, which the next save replaces', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.update.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce({ ...NOTES, body: '# Fixes', version: 5 });

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toBe('conflict');
    expect(store.current()?.version).toBe(5);
    expect(toasts.error).toHaveBeenCalledWith('The document changed meanwhile', {
      description:
        'Your draft is kept. Choose Done to replace the other version, or Cancel to read it.',
    });

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toBe('saved');
    expect(api.update).toHaveBeenLastCalledWith('d1', 5, {
      title: 'Release notes 3.1',
      body: '- A',
    });
  });

  it('reads again after a lost answer: saved when the draft is stored', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.update.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api.get.mockResolvedValueOnce({ ...NOTES, body: '- A', version: 4 });

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toBe('saved');
    expect(store.current()?.version).toBe(4);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('reads again after a server error: failed when the version sent is still stored', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.update.mockRejectedValueOnce(problem(503, 'upstream.timeout'));

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toBe('failed');
    expect(toasts.error).toHaveBeenCalledWith('The document could not be saved', {
      description: 'Your draft is kept. Try again in a moment.',
    });
  });

  it('warns when neither the save nor the read that follows it answered', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.update.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api.get.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    expect(await store.save({ title: 'Release notes 3.1', body: '- A' })).toBe('unknown');
    expect(toasts.warning).toHaveBeenCalledWith(
      'The document may not have been saved',
      expect.anything(),
    );
    expect(store.current()?.version).toBe(3);
  });

  it('says a deleted document is gone, and a refused save failed', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.update.mockRejectedValueOnce(problem(404, 'document.not-found'));
    expect(await store.save({ title: 'A', body: '' })).toBe('gone');

    api.update.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));
    expect(await store.save({ title: 'A', body: '' })).toBe('failed');
    expect(toasts.error).toHaveBeenLastCalledWith('The document could not be saved', {
      description: 'You can no longer edit the documents of this space.',
    });
  });

  it('sends nothing once the organization changed', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.update.mockImplementationOnce(() => {
      organization.set({ ...ATELIER_NORD, id: 'o2' });
      return Promise.resolve({ ...NOTES, version: 4 });
    });

    expect(await store.save({ title: 'A', body: '' })).toBe('cancelled');
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('deletes from the version shown', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();

    expect(await store.remove()).toBe('deleted');
    expect(api.remove).toHaveBeenCalledWith('d1', 3);
  });

  it('shows a newer version read in the background, and keeps it when that read fails', async () => {
    const store: InstanceType<typeof DocumentStore> = await opened();
    api.get.mockResolvedValueOnce({ ...NOTES, title: 'Release notes 3.2', version: 4 });

    await store.refresh();
    expect(store.current()?.title).toBe('Release notes 3.2');
    expect(api.get).toHaveBeenLastCalledWith('d1', { passive: true });

    api.get.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    await store.refresh();
    expect(store.current()?.title).toBe('Release notes 3.2');
  });
});
