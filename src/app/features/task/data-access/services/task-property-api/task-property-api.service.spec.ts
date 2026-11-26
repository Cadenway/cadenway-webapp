import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TaskApproval } from '../../../models/task-property/task-property.interface';
import { TaskVersionConflict } from '../../../models/task-write-error/task-write-error.model';
import { TaskPropertyApi } from './task-property-api.service';

/**
 * Function settle
 *
 * @description
 * Lets the service send its next page after an answer.
 *
 * @returns {Promise<void>} Resolves after the pending microtasks.
 */
async function settle(): Promise<void> {
  for (let index: number = 0; index < 5; index++) await Promise.resolve();
}

describe('TaskPropertyApi', () => {
  let http: HttpTestingController;
  let api: TaskPropertyApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TaskPropertyApi);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the watchers to their last page', async () => {
    const watchers: Promise<readonly string[]> = api.watchers('CAD-482');
    http
      .expectOne(
        (request) => request.url === '/v1/tasks/CAD-482/watchers' && !request.params.has('cursor'),
      )
      .flush({ items: [{ userId: 'u1' }], nextCursor: 'next', total: 2, callerFollows: true });
    await settle();
    http
      .expectOne((request) => request.params.get('cursor') === 'next')
      .flush({ items: [{ userId: 'u2' }], nextCursor: null, total: 2, callerFollows: true });

    expect(await watchers).toEqual(['u1', 'u2']);
  });

  it('gives the version of an unassignment from its ETag', async () => {
    const version: Promise<number | null> = api.unassign('CAD-482', 'u2');
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482/assignees/u2');

    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content', headers: { ETag: '"9"' } });

    expect(await version).toBe(9);
  });

  it('starts an approval round against the task version and reports a version conflict', async () => {
    const started: Promise<TaskApproval> = api.requestApproval('CAD-482', 7, ['u2']);
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482/approvals/request');

    expect(request.request.headers.get('If-Match')).toBe('"7"');
    expect(request.request.body).toEqual({ reviewerUserIds: ['u2'] });
    request.flush({
      taskKey: 'CAD-482',
      taskVersion: 8,
      taskStatus: 'review',
      current: {
        roundId: 'r1',
        requesterUserId: 'u1',
        requestedAt: '2026-11-08T09:00:00Z',
        status: 'pending',
        reviewers: [{ reviewerUserId: 'u2', decision: null, decidedAt: null, commentId: null }],
      },
    });

    expect(await started).toEqual({
      taskVersion: 8,
      reviewers: [{ userId: 'u2', decision: null }],
    });

    const conflicting: Promise<TaskApproval> = api.requestApproval('CAD-482', 7, ['u3']);
    http
      .expectOne('/v1/tasks/CAD-482/approvals/request')
      .flush(
        { type: 'about:blank', code: 'request.version-mismatch' },
        { status: 412, statusText: 'Precondition Failed' },
      );

    await expect(conflicting).rejects.toBeInstanceOf(TaskVersionConflict);
  });

  it('creates a dependency with an Idempotency-Key and reads its version', async () => {
    const created: ReturnType<TaskPropertyApi['addDependency']> = api.addDependency(
      'CAD-482',
      'CAD-479',
      'blocked-by',
      'key-1',
    );
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482/dependencies');

    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.request.body).toEqual({ otherTaskKey: 'CAD-479', direction: 'blocked-by' });
    const task: (key: string) => Record<string, unknown> = (
      key: string,
    ): Record<string, unknown> => ({
      key,
      name: key,
      status: 'todo',
      cancelReason: null,
      priority: 'moyenne',
      dueDate: null,
    });
    request.flush(
      { id: 'd1', blocker: task('CAD-479'), blocked: task('CAD-482') },
      { status: 201, statusText: 'Created', headers: { ETag: '"8"' } },
    );

    expect(await created).toEqual({
      version: 8,
      dependency: {
        id: 'd1',
        direction: 'blocked-by',
        task: { key: 'CAD-479', name: 'CAD-479', status: 'todo', milestone: false, due: null },
      },
    });
  });
});
