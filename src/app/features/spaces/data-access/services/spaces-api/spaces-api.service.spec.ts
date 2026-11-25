import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SpacesService } from '@cadenway/api-client';
import { delay, NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { UnavailableRouteError } from '@shared/route-errors';

import type { SpaceDraft } from '../../../models/space/space.interface';
import { SpacesApi } from './spaces-api.service';

describe('SpacesApi', () => {
  let spaces: Record<string, Mock>;
  let api: SpacesApi;

  beforeEach(() => {
    spaces = {
      listSpaces: vi
        .fn()
        .mockReturnValueOnce(
          of({ items: [{ id: 'sp-1', name: 'Product', statuses: {} }], nextCursor: 'c2' }),
        )
        .mockReturnValueOnce(
          of({ items: [{ id: 'sp-2', name: 'Design', statuses: {} }], nextCursor: null }),
        ),
      getSpace: vi.fn(() =>
        throwError(() => new HttpErrorResponse({ status: 503, error: { status: 503 } })),
      ),
      getSpaceOverview: vi.fn(() =>
        of({ spaceId: 'sp-1', listCount: 0, taskCount: 4, items: [], nextCursor: null }),
      ),
      listSpaceMilestones: vi.fn(() => of({ items: [], nextCursor: null, total: 0 })),
      listFavorites: vi.fn(() =>
        of({
          items: [
            { id: 'f1', kind: 'list', targetId: 'l-1', target: { name: 'Bugs', href: '/' } },
            { id: 'f2', kind: 'document', targetId: 'd-1', target: { name: 'Doc', href: '/' } },
          ],
          nextCursor: null,
        }),
      ),
      createFavorite: vi.fn(() =>
        of({ id: 'f3', kind: 'space', targetId: 'sp-1', target: { name: 'Product', href: '/' } }),
      ),
      deleteFavorite: vi.fn(() => of(undefined)),
      createSpace: vi.fn(() =>
        of({
          space: { id: 'sp-hr', name: 'HR', prefix: 'HR', statuses: {}, visibility: 'private' },
          firstList: { id: 'l-1', spaceId: 'sp-hr', name: 'First list', version: 1 },
        }),
      ),
      updateSpace: vi.fn(() =>
        of({ id: 'sp-1', name: 'Product 2', prefix: 'CAD', statuses: {}, visibility: 'private' }),
      ),
      deleteSpace: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SpacesService, useValue: spaces }] });
    api = TestBed.inject(SpacesApi);
  });

  it('follows every page of the spaces', async () => {
    expect((await api.spaces()).map((space) => space.name)).toEqual(['Product', 'Design']);
    expect(spaces['listSpaces']).toHaveBeenLastCalledWith({ limit: 100, cursor: 'c2' });
  });

  it('fails an overview whose page takes longer than its page deadline', async () => {
    spaces['getSpaceOverview'].mockReturnValueOnce(NEVER);

    await expect(api.overview('sp-1', '2026-11-08', undefined, 10)).rejects.toBeInstanceOf(Error);
  });

  it('gives each overview page its own deadline, not the whole read', async () => {
    spaces['getSpaceOverview']
      .mockReturnValueOnce(
        of({ spaceId: 'sp-1', listCount: 0, taskCount: 4, items: [], nextCursor: 'c2' }).pipe(
          delay(30),
        ),
      )
      .mockReturnValueOnce(
        of({ spaceId: 'sp-1', listCount: 0, taskCount: 4, items: [], nextCursor: null }).pipe(
          delay(30),
        ),
      );

    expect((await api.overview('sp-1', '2026-11-08', undefined, 50)).taskCount).toBe(4);
  });

  it('turns a failed space read into the unavailable state', async () => {
    await expect(api.space('sp-1')).rejects.toBeInstanceOf(UnavailableRouteError);
  });

  it('reads the overview, the milestones and the favorites, and writes favorites', async () => {
    expect((await api.overview('sp-1', '2026-11-08')).taskCount).toBe(4);
    expect((await api.milestones('sp-1')).total).toBe(0);
    expect((await api.favorites()).map((favorite) => favorite.id)).toEqual(['f1']);
    expect((await api.addFavorite('space', 'sp-1'))?.id).toBe('f3');
    await api.removeFavorite('f3');
    expect(spaces['deleteFavorite']).toHaveBeenCalledWith('f3');
  });

  it('creates a space with its first list and sends a visibility change only', async () => {
    const draft: SpaceDraft = {
      name: 'HR',
      prefix: 'HR',
      description: null,
      icon: null,
      color: 'gris',
      private: true,
    };
    const created: Awaited<ReturnType<SpacesApi['createSpace']>> = await api.createSpace(
      draft,
      'key-1',
    );

    expect(created.firstList.id).toBe('l-1');
    expect(created.space.private).toBe(true);
    expect(spaces['createSpace']).toHaveBeenCalledWith(
      {
        name: 'HR',
        prefix: 'HR',
        description: null,
        icon: null,
        color: 'gris',
        visibility: 'private',
      },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
    await api.updateSpace(created.space, { ...draft, name: 'HR 2' });
    expect(spaces['updateSpace']).toHaveBeenCalledWith('sp-hr', {
      name: 'HR 2',
      prefix: 'HR',
      description: null,
      icon: null,
      color: 'gris',
    });
    await api.deleteSpace('sp-hr');
    expect(spaces['deleteSpace']).toHaveBeenCalledWith('sp-hr');
  });
});
