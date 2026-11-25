import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  TaskBulkOutcome,
  TaskBulkSelection,
} from '../../../models/task-bulk/task-bulk.interface';
import { TaskActionsApi } from './task-actions-api.service';

/**
 * Constant BULK_URL
 *
 * @description
 * Address of `executeBulkTaskAction`.
 *
 * @type {string}
 */
const BULK_URL: string = '/v1/tasks/bulk-actions';

/**
 * Function settle
 *
 * @description
 * Lets the service send the next chunk after an answer.
 *
 * @returns {Promise<void>} Resolves after the pending microtasks.
 */
async function settle(): Promise<void> {
  for (let index: number = 0; index < 5; index++) await Promise.resolve();
}

describe('TaskActionsApi', () => {
  let http: HttpTestingController;
  let api: TaskActionsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TaskActionsApi);
  });

  it('returns the versions and trash entries of the applied tasks', async () => {
    const outcome: Promise<TaskBulkOutcome> = api.bulk(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'trash' },
      () => true,
    );
    const request: TestRequest = http.expectOne(BULK_URL);

    expect(request.request.body).toEqual({
      selection: [{ taskKey: 'CAD-482', version: 3 }],
      action: { type: 'trash' },
    });
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    request.flush({
      results: [{ taskKey: 'CAD-482', version: 4, trashEntryId: 'trash-1' }],
      affectedCount: 2,
    });
    await expect(outcome).resolves.toEqual({
      affected: 2,
      done: [{ taskKey: 'CAD-482', version: 4, newTaskKey: null, trashEntryId: 'trash-1' }],
      failed: [],
      unknown: [],
      notSent: [],
    });
  });

  it('retries an uncertain chunk once with the same idempotency key', async () => {
    const outcome: Promise<TaskBulkOutcome> = api.bulk(
      [{ taskKey: 'CAD-482' }],
      { type: 'priority', priority: 'haute' },
      () => true,
    );
    const first: TestRequest = http.expectOne(BULK_URL);
    const key: string | null = first.request.headers.get('Idempotency-Key');
    first.flush(null, { status: 503, statusText: 'Unavailable' });
    await settle();
    const second: TestRequest = http.expectOne(BULK_URL);

    expect(second.request.headers.get('Idempotency-Key')).toBe(key);
    second.flush({ results: [{ taskKey: 'CAD-482', version: 5 }], affectedCount: 1 });
    await expect(outcome).resolves.toMatchObject({ done: [{ taskKey: 'CAD-482', version: 5 }] });
  });

  it('sends 50 tasks per chunk and reports a refused chunk without stopping', async () => {
    const selection: TaskBulkSelection[] = Array.from({ length: 51 }, (_: unknown, index) => ({
      taskKey: `CAD-${String(index)}`,
    }));
    const outcome: Promise<TaskBulkOutcome> = api.bulk(
      selection,
      { type: 'unassign', userId: 'u1' },
      () => true,
    );
    const first: TestRequest = http.expectOne(BULK_URL);

    expect((first.request.body as { selection: unknown[] }).selection).toHaveLength(50);
    first.flush({ code: 'request.version-mismatch' }, { status: 412, statusText: 'Failed' });
    await settle();
    http.expectOne(BULK_URL).flush({ results: [{ taskKey: 'CAD-50' }], affectedCount: 1 });
    const result: TaskBulkOutcome = await outcome;

    expect(result.failed).toHaveLength(50);
    expect(result.done.map((entry) => entry.taskKey)).toEqual(['CAD-50']);
  });

  it('sends nothing once the caller is no longer current', async () => {
    await expect(
      api.bulk([{ taskKey: 'CAD-482' }], { type: 'duplicate' }, () => false),
    ).resolves.toMatchObject({ notSent: [{ taskKey: 'CAD-482' }], done: [] });
    http.expectNone(BULK_URL);
  });

  it('restores a trash entry', async () => {
    const restored: Promise<void> = api.restore('trash-1');
    const request: TestRequest = http.expectOne('/v1/trash/entries/trash-1/restore');

    expect(request.request.method).toBe('POST');
    request.flush({ subtaskCount: 0 });
    await expect(restored).resolves.toBeUndefined();
  });
});
