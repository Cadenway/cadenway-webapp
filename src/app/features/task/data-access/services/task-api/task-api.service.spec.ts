import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../../models/task-write-error/task-write-error.model';
import { TaskApi } from './task-api.service';

/**
 * Constant task
 *
 * @description
 * CAD-482 as `PATCH /v1/tasks/CAD-482` answers it.
 *
 * @type {Record<string, unknown>}
 */
const task: Record<string, unknown> = {
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  description: null,
  status: 'review',
  cancelReason: null,
  cancelNote: null,
  priority: 'haute',
  assignees: [{ userId: 'u1' }],
  dueDate: null,
  startDate: null,
  estimateMinutes: null,
  labels: [],
  parentKey: null,
  listId: 'sprint-14',
  spaceId: 'produit',
  subtaskCounts: { total: 0, closed: 0 },
  checklist: [],
  checklistCounts: { total: 0, done: 0 },
  completedAt: null,
  createdAt: '2026-11-03T09:00:00Z',
  createdBy: { userId: 'u1' },
  updatedAt: '2026-11-08T09:00:00Z',
  version: 4,
};

describe('TaskApi', () => {
  let http: HttpTestingController;
  let api: TaskApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TaskApi);
  });

  it('sends the status with If-Match and returns the saved version', async () => {
    const answer: Promise<TaskSummary> = firstValueFrom(
      api.changeStatus('CAD-482', 3, 'review', null),
    );
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('If-Match')).toBe('"3"');
    expect(request.request.body).toEqual({ status: 'review' });
    request.flush(task);
    await expect(answer).resolves.toMatchObject({ status: 'review', version: 4 });
    http.verify();
  });

  it('sends the reason and the note of a cancellation', () => {
    void firstValueFrom(
      api.changeStatus('CAD-482', 3, 'cancelled', { reason: 'obsolete', note: '' }),
    ).catch(() => undefined);

    expect(http.expectOne('/v1/tasks/CAD-482').request.body).toEqual({
      status: 'cancelled',
      cancelReason: 'obsolete',
      cancelNote: null,
    });
  });

  it('rejects a version mismatch with TaskVersionConflict', async () => {
    const answer: Promise<TaskSummary> = firstValueFrom(
      api.changeStatus('CAD-482', 3, 'done', null),
    );
    http
      .expectOne('/v1/tasks/CAD-482')
      .flush(
        { code: 'request.version-mismatch', status: 412 },
        { status: 412, statusText: 'Precondition Failed' },
      );

    await expect(answer).rejects.toBeInstanceOf(TaskVersionConflict);
  });

  it('keeps an organization change as the HTTP failure', async () => {
    const answer: Promise<TaskSummary> = firstValueFrom(
      api.changeStatus('CAD-482', 3, 'done', null),
    );
    http
      .expectOne('/v1/tasks/CAD-482')
      .flush(
        { code: 'organization.context-changed', status: 412 },
        { status: 412, statusText: 'Precondition Failed' },
      );

    await expect(answer).rejects.not.toBeInstanceOf(TaskVersionConflict);
  });

  it('reads a task again without the HTTP cache', async () => {
    const answer: Promise<TaskSummary> = firstValueFrom(api.read('CAD-482'));
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482');

    expect(request.request.method).toBe('GET');
    expect(request.request.cache).toBe('no-store');
    request.flush(task);
    await expect(answer).resolves.toMatchObject({ key: 'CAD-482', version: 4 });
  });

  it('sends a priority change with If-Match', async () => {
    const answer: Promise<TaskSummary> = firstValueFrom(
      api.changePriority('CAD-482', 3, 'urgente'),
    );
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('If-Match')).toBe('"3"');
    expect(request.request.body).toEqual({ priority: 'urgente' });
    request.flush({ ...task, priority: 'urgente' });
    await expect(answer).resolves.toMatchObject({ priority: 'urgente', version: 4 });
  });

  it('assigns a person with If-Match and maps a mismatch to TaskVersionConflict', async () => {
    const answer: Promise<TaskSummary> = firstValueFrom(api.assign('CAD-482', 3, 'u-ines'));
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482/assignees/u-ines');

    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('If-Match')).toBe('"3"');
    request.flush(
      { code: 'request.version-mismatch', status: 412 },
      { status: 412, statusText: 'Precondition Failed' },
    );
    await expect(answer).rejects.toBeInstanceOf(TaskVersionConflict);
  });

  it('removes an assignee and reads the new version from the ETag', async () => {
    const answer: Promise<number | null> = firstValueFrom(api.unassign('CAD-482', 4, 'u-ines'));
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482/assignees/u-ines');

    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('If-Match')).toBe('"4"');
    request.flush(null, { status: 204, statusText: 'No Content', headers: { ETag: 'W/"5"' } });
    await expect(answer).resolves.toBe(5);
  });
});
