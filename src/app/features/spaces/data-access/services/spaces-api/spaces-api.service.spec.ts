import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SpacesService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { UnavailableRouteError } from '@shared/route-errors';

import { SpacesApi } from './spaces-api.service';

describe('SpacesApi', () => {
  let spaces: Record<string, Mock>;
  let api: SpacesApi;

  beforeEach(() => {
    spaces = {
      listSpaces: vi
        .fn()
        .mockReturnValueOnce(
          of({ items: [{ id: 'sp-1', name: 'Produit', statuses: {} }], nextCursor: 'c2' }),
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
        of({ id: 'f3', kind: 'space', targetId: 'sp-1', target: { name: 'Produit', href: '/' } }),
      ),
      deleteFavorite: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SpacesService, useValue: spaces }] });
    api = TestBed.inject(SpacesApi);
  });

  it('follows every page of the spaces', async () => {
    expect((await api.spaces()).map((space) => space.name)).toEqual(['Produit', 'Design']);
    expect(spaces['listSpaces']).toHaveBeenLastCalledWith({ limit: 100, cursor: 'c2' });
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
});
