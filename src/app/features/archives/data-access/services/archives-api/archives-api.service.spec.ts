import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OrganizationSwitchPendingError, PASSIVE_REQUEST } from '@core/api';

import type { ArchivesRead } from '../../../models/archives-read/archives-read.interface';
import type { ArchiveCheck } from '../../../models/archive-check/archive-check.type';
import {
  ArchivesApi,
  isForbiddenRestore,
  isUncertainRestore,
  MAX_PAGES,
  REQUEST_TIMEOUT_MS,
  RESTORE_TIMEOUT_MS,
} from './archives-api.service';

/**
 * Function listEntry
 *
 * @description
 * An archived list of the gateway.
 *
 * @param {string} id - List id.
 * @returns {Record<string, unknown>} The entry.
 */
function listEntry(id: string): Record<string, unknown> {
  return {
    list: {
      id,
      spaceId: 'sp-product',
      name: id,
      icon: null,
      color: 'gris',
      sprint: null,
      createdAt: '2026-10-16T10:00:00Z',
      version: 1,
      archivedAt: '2026-11-03T09:00:00Z',
      archivedBy: { type: 'user', id: 'u-camille' },
    },
    taskCount: 2,
  };
}

describe('ArchivesApi', () => {
  let api: ArchivesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ArchivesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads both tabs to their last page, passively when asked', async () => {
    const reading: Promise<ArchivesRead> = api.read(true);

    const firstLists: TestRequest = http.expectOne(
      (request) => request.url === '/v1/archives/lists' && !request.params.has('cursor'),
    );
    expect(firstLists.request.context.get(PASSIVE_REQUEST)).toBe(true);
    expect(firstLists.request.timeout).toBe(REQUEST_TIMEOUT_MS);
    expect(firstLists.request.params.get('limit')).toBe('100');
    firstLists.flush({ items: [listEntry('l-1')], nextCursor: 'c2', total: 2 });
    http
      .expectOne((request) => request.url === '/v1/archives/tasks')
      .flush({ items: [], nextCursor: null, total: 0 });
    await Promise.resolve();
    await Promise.resolve();
    http
      .expectOne(
        (request) => request.url === '/v1/archives/lists' && request.params.get('cursor') === 'c2',
      )
      .flush({ items: [listEntry('l-2')], nextCursor: null, total: 2 });

    const read: ArchivesRead = await reading;
    expect(read.lists.map((list) => list.id)).toEqual(['l-1', 'l-2']);
    expect(read.listTotal).toBe(2);
    expect(read.tasks).toEqual([]);
    expect(read.taskTotal).toBe(0);
  });

  it('stops a tab at its page cap and keeps the gateway total', async () => {
    const reading: Promise<ArchivesRead> = api.read(true);
    http
      .expectOne((request) => request.url === '/v1/archives/tasks')
      .flush({ items: [], nextCursor: null, total: 0 });
    for (let page: number = 1; page <= MAX_PAGES; page += 1) {
      let pending: TestRequest[] = [];
      await expect
        .poll(() => {
          pending = http.match((request) => request.url === '/v1/archives/lists');
          return pending.length;
        })
        .toBe(1);
      pending[0].flush({
        items: [listEntry(`l-${String(page)}`)],
        nextCursor: `c${String(page + 1)}`,
        total: 2_500,
      });
    }

    const read: ArchivesRead = await reading;
    expect(read.lists).toHaveLength(MAX_PAGES);
    expect(read.listTotal).toBe(2_500);
    http.expectNone((request) => request.url === '/v1/archives/lists');
  });

  it('unarchives a list and a task without a version precondition, with the longer timeout', async () => {
    expect(RESTORE_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS);
    const list: Promise<void> = api.unarchiveList('l-sprint13');
    const listRequest: TestRequest = http.expectOne('/v1/lists/l-sprint13/unarchive');
    expect(listRequest.request.method).toBe('POST');
    expect(listRequest.request.headers.has('If-Match')).toBe(false);
    expect(listRequest.request.timeout).toBe(RESTORE_TIMEOUT_MS);
    listRequest.flush({});
    await expect(list).resolves.toBeUndefined();

    const task: Promise<void> = api.unarchiveTask('CAD-430');
    const taskRequest: TestRequest = http.expectOne('/v1/tasks/CAD-430/unarchive');
    expect(taskRequest.request.timeout).toBe(RESTORE_TIMEOUT_MS);
    taskRequest.flush({});
    await expect(task).resolves.toBeUndefined();
  });

  it('reads one item to settle an unknown outcome', async () => {
    const archived: Promise<ArchiveCheck> = api.checkList('l-sprint13');
    const listRead: TestRequest = http.expectOne('/v1/lists/l-sprint13');
    expect(listRead.request.context.get(PASSIVE_REQUEST)).toBe(true);
    expect(listRead.request.cache).toBe('no-store');
    listRead.flush({ id: 'l-sprint13', archivedAt: '2026-11-03T09:00:00Z' });
    await expect(archived).resolves.toBe('archived');

    const restored: Promise<ArchiveCheck> = api.checkTask('CAD-430');
    http.expectOne('/v1/tasks/CAD-430').flush({ key: 'CAD-430', archivedAt: null });
    await expect(restored).resolves.toBe('restored');

    const gone: Promise<ArchiveCheck> = api.checkTask('CAD-431');
    http
      .expectOne('/v1/tasks/CAD-431')
      .flush({ code: 'task.not-found' }, { status: 404, statusText: 'Not Found' });
    await expect(gone).resolves.toBe('gone');

    const failed: Promise<ArchiveCheck> = api.checkList('l-2');
    http.expectOne('/v1/lists/l-2').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(failed).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('tells a missing edit right from another 403', () => {
    expect(
      isForbiddenRestore(
        new HttpErrorResponse({ status: 403, error: { code: 'access.role-insufficient' } }),
      ),
    ).toBe(true);
    expect(
      isForbiddenRestore(new HttpErrorResponse({ status: 403, error: { code: 'auth.scope' } })),
    ).toBe(false);
    expect(isForbiddenRestore(new HttpErrorResponse({ status: 404 }))).toBe(false);
  });

  it('tells an unknown outcome from a refusal', () => {
    expect(isUncertainRestore(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUncertainRestore(new HttpErrorResponse({ status: 408 }))).toBe(true);
    expect(isUncertainRestore(new HttpErrorResponse({ status: 503 }))).toBe(true);
    expect(isUncertainRestore(new Error('timed out'))).toBe(true);
    expect(isUncertainRestore(new HttpErrorResponse({ status: 403 }))).toBe(false);
    expect(isUncertainRestore(new HttpErrorResponse({ status: 404 }))).toBe(false);
    expect(isUncertainRestore(new OrganizationSwitchPendingError())).toBe(false);
  });
});
