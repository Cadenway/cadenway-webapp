import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  type BoardCardPage,
  type BoardLocation,
  BoardOrganizationChanged,
} from '../../../models/sprint-board/sprint-board.model';

import { SprintBoardApi } from './sprint-board.service';

/**
 * Constant location
 *
 * @description
 * An authenticated deep link whose organization must match every board read.
 *
 * @type {BoardLocation}
 */
const location: BoardLocation = {
  organizationId: '01923680-b800-7000-8000-000000000001',
  spaceId: '01923680-b800-7000-8000-000000000010',
  listId: '01923680-b800-7000-8000-000000000020',
  mayEdit: false,
};

describe('SprintBoardApi read preconditions', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    vi.stubGlobal('navigator', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.inject(HttpTestingController).verify();
  });

  it('pins and cancels the coordinated initial reads under a shared session lock', () => {
    const lock: Mock<
      (name: string, options: LockOptions, run: () => Promise<void>) => Promise<void>
    > = vi.fn((_name, _options, run) => run());
    vi.stubGlobal('navigator', { locks: { request: lock } });
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const request: Subscription = TestBed.inject(SprintBoardApi).load(location).subscribe();
    const space: TestRequest = http.expectOne(`/v1/spaces/${location.spaceId}`);
    const counts: TestRequest = http.expectOne(
      (request) => request.url === `/v1/lists/${location.listId}/task-groups`,
    );
    for (const read of [space, counts]) {
      expect(read.request.headers.get('If-Organization-Match')).toBe(location.organizationId);
      expect(read.request.cache).toBe('no-store');
    }
    http.expectNone('/v1/organization');
    expect(lock).toHaveBeenCalledWith(
      'cadenway-gateway-session',
      expect.objectContaining({ mode: 'shared' }),
      expect.any(Function),
    );

    request.unsubscribe();

    expect(space.cancelled).toBe(true);
    expect(counts.cancelled).toBe(true);
  });

  it('pins continuation reads and reports an organization switch after navigation', async () => {
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const result: Promise<BoardCardPage> = firstValueFrom(
      TestBed.inject(SprintBoardApi).loadPage(location, 'review', 'opaque-cursor'),
    );
    const page: TestRequest = http.expectOne(
      (request) => request.url === `/v1/lists/${location.listId}/tasks`,
    );
    expect(page.request.headers.get('If-Organization-Match')).toBe(location.organizationId);
    expect(page.request.params.get('cursor')).toBe('opaque-cursor');
    page.flush(
      { code: 'organization.context-changed' },
      { status: 412, statusText: 'Precondition Failed' },
    );

    await expect(result).rejects.toBeInstanceOf(BoardOrganizationChanged);
  });
});
