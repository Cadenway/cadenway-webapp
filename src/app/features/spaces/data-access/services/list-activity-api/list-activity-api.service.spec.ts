import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { type ListListActivityClientResult, ListsService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AccessDeniedRouteError, UnavailableRouteError } from '@shared/route-errors';

import type { ListActivityPage } from '../../../models/list-activity/list-activity.interface';
import { ListActivityApi } from './list-activity-api.service';

/**
 * Constant answer
 *
 * @description
 * A page of the activity of `Sprint 14`: a status change, an assignment, a comment and a kind
 * this version does not know.
 *
 * @type {ListListActivityClientResult}
 */
const answer: ListListActivityClientResult = {
  items: [
    {
      id: 'e1',
      occurredAt: '2026-11-08T07:40:00Z',
      kind: 'status',
      actor: { type: 'user', id: 'u-camille' },
      task: { key: 'CAD-479', name: 'Fix the redirect after sign-in', status: 'progress' },
      listId: 'sprint-14',
      status: { from: 'todo', to: 'progress' },
    },
    {
      id: 'e2',
      occurredAt: '2026-11-07T10:02:00Z',
      kind: 'assign',
      actor: { type: 'git', id: 'github', provider: 'github' },
      task: { key: 'CAD-490', name: 'Log SSO sign-ins', status: 'todo' },
      listId: 'sprint-14',
      assignee: { userId: 'u-ines', added: true },
    },
    {
      id: 'e3',
      occurredAt: '2026-11-06T09:00:00Z',
      kind: 'comment',
      actor: { type: 'user', id: 'u-hugo' },
      task: { key: 'CAD-482', name: 'SSO screen', status: 'review' },
      listId: 'sprint-14',
      commentId: 'c1',
      commentExcerpt: 'See **the** [spec](https://example.test)\n\nfor `details`',
    },
    {
      id: 'e4',
      occurredAt: '2026-11-06T08:00:00Z',
      kind: 'label',
      actor: { type: 'system', id: 'task-service' },
      task: { key: 'CAD-482', name: 'SSO screen', status: 'review' },
      listId: 'sprint-14',
    },
  ],
  nextCursor: 'p2',
  total: 18,
};

describe('ListActivityApi', () => {
  let listListActivity: Mock;
  let api: ListActivityApi;

  beforeEach(() => {
    listListActivity = vi.fn(() => of(answer));
    TestBed.configureTestingModule({
      providers: [ListActivityApi, { provide: ListsService, useValue: { listListActivity } }],
    });
    api = TestBed.inject(ListActivityApi);
  });

  it('reads every kind and everyone without filter parameters, bypassing the cache', async () => {
    const page: ListActivityPage = await api.page(
      'sprint-14',
      { kinds: [], actorId: null },
      null,
      50,
    );

    expect(listListActivity).toHaveBeenCalledWith(
      'sprint-14',
      { limit: 50 },
      { cache: 'no-store' },
    );
    expect(page.total).toBe(18);
    expect(page.nextCursor).toBe('p2');
    expect(page.items.map((entry) => entry.change)).toEqual([
      { kind: 'status', from: 'todo', to: 'progress' },
      { kind: 'assign', userId: 'u-ines', added: true },
      { kind: 'comment', excerpt: 'See the spec for details' },
      { kind: 'other' },
    ]);
    expect(page.items[1].actor).toEqual({ type: 'git', id: 'github', provider: 'github' });
    expect(page.items[0].actor.provider).toBeNull();
    expect(page.items[0].task).toEqual({
      key: 'CAD-479',
      name: 'Fix the redirect after sign-in',
      status: 'progress',
    });
  });

  it('sends the kinds, the person and the cursor of a later page', async () => {
    await api.page('sprint-14', { kinds: ['status', 'due'], actorId: 'u-camille' }, 'p2', 50);

    expect(listListActivity).toHaveBeenCalledWith(
      'sprint-14',
      { limit: 50, kind: ['status', 'due'], actorId: ['u-camille'], cursor: 'p2' },
      { cache: 'no-store' },
    );
  });

  it('rejects with the typed route error of the list', async () => {
    listListActivity.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: { status: 503, code: 'service.unavailable' },
          }),
      ),
    );
    await expect(
      api.page('sprint-14', { kinds: [], actorId: null }, null, 50),
    ).rejects.toBeInstanceOf(UnavailableRouteError);

    listListActivity.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { status: 404, code: 'list.not-found' },
          }),
      ),
    );
    await expect(
      api.page('sprint-14', { kinds: [], actorId: null }, null, 50),
    ).rejects.toBeInstanceOf(AccessDeniedRouteError);
  });
});
