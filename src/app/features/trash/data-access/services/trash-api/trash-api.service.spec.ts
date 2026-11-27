import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TrashEntry as TrashEntryDto } from '@cadenway/api-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OrganizationSwitchPendingError, PASSIVE_REQUEST } from '@core/api';

import type { TrashEntry } from '../../../models/trash-entry/trash-entry.interface';
import type { TrashListing } from '../../../models/trash-listing/trash-listing.interface';
import type { TrashRestore } from '../../../models/trash-restore/trash-restore.interface';
import {
  isTrashEntryGone,
  isTrashEntryNotReady,
  isTrashWriteNotSent,
  isUncertainTrashWrite,
  MAX_PAGES,
  TRASH_READ_DEPTH,
  TrashApi,
} from './trash-api.service';

/**
 * Function dto
 *
 * @description
 * A trash entry of `GET /v1/trash/entries`, from Atelier Nord's `Sprint 14`.
 *
 * @param {string} id - Entry id.
 * @param {string} key - Task key.
 * @returns {TrashEntryDto} The entry.
 */
function dto(id: string, key: string): TrashEntryDto {
  return {
    id,
    task: { key, name: 'Old sign-in screen', status: 'cancelled' },
    parentKey: 'CAD-482',
    subtaskCount: 1,
    list: { id: 'list-sprint-14', spaceId: 'space-product', name: 'Sprint 14', state: 'deleted' },
    trashedAt: '2026-11-06T10:00:00Z',
    trashedBy: { type: 'git', id: 'github' },
    purgeAt: '2026-12-06T10:00:00Z',
  };
}

describe('TrashApi', () => {
  let api: TrashApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TrashApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads every page of the trash, passive when asked, past the HTTP cache', async () => {
    const read: Promise<TrashListing> = api.entries({ passive: true });
    const first: TestRequest = http.expectOne(
      (request) => request.url === '/v1/trash/entries' && !request.params.has('cursor'),
    );
    expect(first.request.params.get('limit')).toBe('100');
    expect(first.request.cache).toBe('no-store');
    expect(first.request.context.get(PASSIVE_REQUEST)).toBe(true);
    first.flush({ items: [dto('e1', 'CAD-452')], nextCursor: 'c2', total: 2 });
    await Promise.resolve();
    const second: TestRequest = http.expectOne(
      (request) => request.url === '/v1/trash/entries' && request.params.get('cursor') === 'c2',
    );
    second.flush({ items: [dto('e2', 'CAD-447')], nextCursor: null, total: 2 });

    const { entries, total }: TrashListing = await read;
    expect(total).toBe(2);
    expect(entries.map((entry: TrashEntry) => entry.taskKey)).toEqual(['CAD-452', 'CAD-447']);
    expect(entries[0]).toMatchObject({
      parentKey: 'CAD-482',
      listName: 'Sprint 14',
      listDeleted: true,
      trashedBy: { kind: 'other', id: 'github' },
    });
  });

  it('reads 1,000 entries by default, then continues from its cursor', async () => {
    const pageOf: (page: number) => readonly TrashEntryDto[] = (page: number) =>
      Array.from({ length: 100 }, (_: unknown, index: number) => {
        const number: string = String(page * 100 + index);
        return dto(`e${number}`, `CAD-${number}`);
      });
    const read: Promise<TrashListing> = api.entries();
    for (let page: number = 0; page < MAX_PAGES; page += 1) {
      await Promise.resolve();
      http
        .expectOne((request) => request.url === '/v1/trash/entries')
        .flush({ items: pageOf(page), nextCursor: `c${String(page + 1)}`, total: 1_150 });
    }
    const first: TrashListing = await read;
    expect(first.entries).toHaveLength(TRASH_READ_DEPTH);
    expect(first.total).toBe(1_150);
    expect(first.nextCursor).toBe('c10');

    const more: Promise<TrashListing> = api.entries({ cursor: first.nextCursor });
    const next: TestRequest = http.expectOne((request) => request.url === '/v1/trash/entries');
    expect(next.request.params.get('cursor')).toBe('c10');
    next.flush({ items: pageOf(10).slice(0, 50), nextCursor: null, total: 1_150 });
    const rest: TrashListing = await more;
    expect(rest.entries).toHaveLength(50);
    expect(rest.nextCursor).toBeNull();
  });

  it('reads as deep as asked, in whole pages', async () => {
    const pageOf: (page: number) => readonly TrashEntryDto[] = (page: number) =>
      Array.from({ length: 100 }, (_: unknown, index: number) => {
        const number: string = String(page * 100 + index);
        return dto(`e${number}`, `CAD-${number}`);
      });
    const read: Promise<TrashListing> = api.entries({ depth: 150 });
    for (let page: number = 0; page < 2; page += 1) {
      await Promise.resolve();
      http
        .expectOne((request) => request.url === '/v1/trash/entries')
        .flush({ items: pageOf(page), nextCursor: `c${String(page + 1)}`, total: 900 });
    }

    const listed: TrashListing = await read;
    expect(listed.entries).toHaveLength(200);
    expect(listed.nextCursor).toBe('c2');
  });

  it('names the members of every page of the directory', async () => {
    const read: Promise<ReadonlyMap<string, string>> = api.members();
    http
      .expectOne((request) => request.url === '/v1/members')
      .flush({
        items: [{ userId: 'user-camille', name: 'Camille Martin' }],
        nextCursor: null,
      });

    expect((await read).get('user-camille')).toBe('Camille Martin');
  });

  it('maps what a restore brought back', async () => {
    const restore: Promise<TrashRestore> = api.restore('e1');
    const request: TestRequest = http.expectOne(
      (candidate) => candidate.url === '/v1/trash/entries/e1/restore',
    );
    expect(request.request.params.get('reportNotReady')).toBe('true');
    expect(request.request.method).toBe('POST');
    request.flush({
      task: { key: 'CAD-452', name: 'Old sign-in screen', status: 'cancelled' },
      list: { name: 'Sprint 14' },
      subtaskCount: 2,
      detached: true,
      listRestored: false,
      spaceRestored: false,
    });

    await expect(restore).resolves.toEqual({
      taskKey: 'CAD-452',
      taskName: 'Old sign-in screen',
      status: 'cancelled',
      listName: 'Sprint 14',
      subtaskCount: 2,
      detached: true,
    });
  });

  it('purges an entry and empties the trash', async () => {
    const purge: Promise<void> = api.purge('e1');
    const erase: TestRequest = http.expectOne('/v1/trash/entries/e1');
    expect(erase.request.method).toBe('DELETE');
    erase.flush(null, { status: 204, statusText: 'No Content' });
    await expect(purge).resolves.toBeUndefined();

    const empty: Promise<number> = api.empty();
    http.expectOne('/v1/trash/empty').flush({ entryCount: 12 });
    await expect(empty).resolves.toBe(12);
  });

  it('tells a lost answer and a gone entry from a refusal', () => {
    expect(isUncertainTrashWrite(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUncertainTrashWrite(new HttpErrorResponse({ status: 408 }))).toBe(true);
    expect(isUncertainTrashWrite(new HttpErrorResponse({ status: 502 }))).toBe(true);
    expect(isUncertainTrashWrite(new Error('Timeout has occurred'))).toBe(true);
    expect(isUncertainTrashWrite(new HttpErrorResponse({ status: 403 }))).toBe(false);
    const gone: HttpErrorResponse = new HttpErrorResponse({
      status: 404,
      error: { code: 'trash-entry.not-found' },
    });
    expect(isTrashEntryGone(gone)).toBe(true);
    expect(isUncertainTrashWrite(gone)).toBe(false);
    const notReady: HttpErrorResponse = new HttpErrorResponse({
      status: 409,
      error: { code: 'trash-entry.not-restorable-yet' },
    });
    expect(isTrashEntryNotReady(notReady)).toBe(true);
    expect(isUncertainTrashWrite(notReady)).toBe(false);
    const blocked: OrganizationSwitchPendingError = new OrganizationSwitchPendingError();
    expect(isTrashWriteNotSent(blocked)).toBe(true);
    expect(isUncertainTrashWrite(blocked)).toBe(false);
  });
});
