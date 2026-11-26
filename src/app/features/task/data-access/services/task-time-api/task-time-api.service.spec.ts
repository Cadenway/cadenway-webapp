import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TaskTimeEntry, TaskTimeLog } from '../../../models/task-time/task-time.interface';
import { TaskTimeApi } from './task-time-api.service';

/**
 * Constant ENTRIES_URL
 *
 * @description
 * Address of the time entries of CAD-482.
 *
 * @type {string}
 */
const ENTRIES_URL: string = '/v1/tasks/CAD-482/time-entries';

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

describe('TaskTimeApi', () => {
  let http: HttpTestingController;
  let api: TaskTimeApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TaskTimeApi);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the entries to their last page with the total of all of them', async () => {
    const log: Promise<TaskTimeLog> = api.log('CAD-482');
    const entry: (id: string, note: string | null) => Record<string, unknown> = (
      id: string,
      note: string | null,
    ): Record<string, unknown> => ({
      id,
      taskKey: 'CAD-482',
      authorUserId: 'u1',
      minutes: 45,
      workDate: '2026-11-08',
      note,
      createdAt: '2026-11-08T09:05:00Z',
    });
    http
      .expectOne((request) => request.url === ENTRIES_URL && !request.params.has('cursor'))
      .flush({ items: [entry('e1', null)], nextCursor: 'next', total: 2, totalMinutes: 90 });
    await settle();
    http
      .expectOne((request) => request.params.get('cursor') === 'next')
      .flush({
        items: [entry('e2', 'OAuth buttons')],
        nextCursor: null,
        total: 2,
        totalMinutes: 90,
      });

    const read: TaskTimeLog = await log;

    expect(read.totalMinutes).toBe(90);
    expect(read.entries.map((item: TaskTimeEntry) => [item.id, item.note])).toEqual([
      ['e1', ''],
      ['e2', 'OAuth buttons'],
    ]);
  });

  it('records time with an Idempotency-Key and leaves an empty note out', async () => {
    const recorded: Promise<TaskTimeEntry> = api.record(
      'CAD-482',
      { minutes: 15, note: '  ' },
      '2026-11-08',
      'key-1',
    );
    const request: TestRequest = http.expectOne(ENTRIES_URL);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.request.body).toEqual({ minutes: 15, workDate: '2026-11-08' });
    request.flush({
      id: 'e3',
      taskKey: 'CAD-482',
      authorUserId: 'u1',
      minutes: 15,
      workDate: '2026-11-08',
      note: null,
      createdAt: '2026-11-08T10:00:00Z',
    });

    expect((await recorded).minutes).toBe(15);
  });
});
