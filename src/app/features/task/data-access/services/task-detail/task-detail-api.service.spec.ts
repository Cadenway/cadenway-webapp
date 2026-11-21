import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { withSessionLock } from '@features/auth';
import { firstValueFrom, type Observable, of, type Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  TaskDetailView,
  TaskStatusConfirmation,
} from '../../../models/task-detail/task-detail.model';
import { TaskDetailApi } from './task-detail-api.service';

/**
 * Function stubSessionLocks
 *
 * @description
 * Queues one exclusive browser lock and holds it while the callback promise settles.
 */
function stubSessionLocks(): void {
  let tail: Promise<void> = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name: string, options: LockOptions, run: () => Promise<void>): Promise<void> => {
        const result: Promise<void> = tail.then(() => {
          options.signal?.throwIfAborted();
          return run();
        });
        tail = result.catch(() => undefined);
        return result;
      },
    },
  });
}

describe('TaskDetailApi organization binding', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    stubSessionLocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.inject(HttpTestingController).verify();
  });

  it('bypasses the browser cache when loading task detail', async () => {
    const api: TaskDetailApi = TestBed.inject(TaskDetailApi);
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const result: Promise<TaskDetailView> = firstValueFrom(api.load('CAD-482', 'org-a'));
    const current: TestRequest = await vi.waitFor(() => http.expectOne('/v1/organization'));
    current.flush({ id: 'org-a' });

    const detail: TestRequest = http.expectOne({ method: 'GET', url: '/v1/tasks/CAD-482/detail' });
    expect(detail.request.cache).toBe('no-store');
    detail.flush(null, { status: 503, statusText: 'Service Unavailable' });
    await expect(result).rejects.toMatchObject({ failure: 'unavailable' });
  });

  it('checks the live organization and declines to write across an organization switch', async () => {
    const api: TaskDetailApi = TestBed.inject(TaskDetailApi);
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const result: Promise<TaskStatusConfirmation> = firstValueFrom(
      api.changeStatus('CAD-482', 'review', 3, 'org-a'),
    );
    const current: TestRequest = await vi.waitFor(() => http.expectOne('/v1/organization'));

    expect(current.request.cache).toBe('no-store');
    current.flush({ id: 'org-b' });

    await expect(result).rejects.toMatchObject({ failure: 'organization-changed' });
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('keeps the lock through an in-flight PATCH when the page detaches', async () => {
    const api: TaskDetailApi = TestBed.inject(TaskDetailApi);
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const page: Subscription = api.changeStatus('CAD-482', 'review', 3, 'org-a').subscribe();
    const current: TestRequest = await vi.waitFor(() => http.expectOne('/v1/organization'));
    current.flush({ id: 'org-a' });

    const write: TestRequest = http.expectOne((request) => request.method === 'PATCH');
    expect(write.request.headers.get('If-Match')).toBe('"3"');
    page.unsubscribe();
    const switchOrganization: ReturnType<typeof vi.fn<() => Observable<undefined>>> = vi.fn<
      () => Observable<undefined>
    >(() => of(undefined));
    const next: Promise<undefined> = firstValueFrom(withSessionLock(switchOrganization));
    await Promise.resolve();

    expect(write.cancelled).toBe(false);
    expect(switchOrganization).not.toHaveBeenCalled();
    write.flush({ key: 'CAD-482', status: 'review', version: 4 });
    await next;
    expect(switchOrganization).toHaveBeenCalledOnce();
  });

  it('fails closed before transport when browser locks are unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const api: TaskDetailApi = TestBed.inject(TaskDetailApi);
    const http: HttpTestingController = TestBed.inject(HttpTestingController);

    await expect(
      firstValueFrom(api.changeStatus('CAD-482', 'review', 3, 'org-a')),
    ).rejects.toMatchObject({ failure: 'unavailable' });
    http.expectNone(() => true);
  });
});
