import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SpacesPageData,
  SpacesPageRequest,
} from '../../../models/list-navigation/list-navigation.model';

import { ListNavigation } from './list-navigation.service';

/**
 * Constant sprint
 *
 * @description
 * Synthetic authenticated route and continuation used by the generated clients.
 *
 * @type {SpacesPageRequest}
 */
const sprint: Extract<SpacesPageRequest, { kind: 'tasks' }> = {
  kind: 'tasks',
  spaceId: '01923680-b800-7000-8000-000000000010',
  listId: '01923680-b800-7000-8000-000000000020',
  organizationId: '01923680-b800-7000-8000-000000000030',
  cursor: 'opaque-page-two',
};

describe('ListNavigation', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, _options: LockOptions, run: () => Promise<void>) => run(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.inject(HttpTestingController).verify();
  });

  it('loads the selected sprint and maps the bounded task page with its continuation', async () => {
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const result: Promise<SpacesPageData> = firstValueFrom(
      TestBed.inject(ListNavigation).load(sprint),
    );

    const list: TestRequest = http.expectOne(`/v1/lists/${sprint.listId}`);
    expect(list.request.headers.get('If-Organization-Match')).toBe(sprint.organizationId);
    list.flush({
      id: sprint.listId,
      spaceId: sprint.spaceId,
      name: 'Sprint 14',
      archivedAt: null,
      sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: 'Livrer la connexion SSO.' },
    });

    const tasks: TestRequest = http.expectOne(
      (request) => request.url === `/v1/lists/${sprint.listId}/tasks`,
    );
    expect(tasks.request.params.get('cursor')).toBe('opaque-page-two');
    expect(tasks.request.params.get('limit')).toBe('50');
    expect(tasks.request.params.get('sort')).toBe('manual');
    expect(tasks.request.headers.get('If-Organization-Match')).toBe(sprint.organizationId);
    tasks.flush({
      items: [
        {
          key: 'CAD-482',
          name: 'Refondre l’écran de connexion SSO',
          status: 'progress',
          dueDate: '2026-11-12',
          assignees: [{ userId: '01923680-b800-7000-8000-000000000030' }],
        },
      ],
      total: 51,
      nextCursor: 'opaque-page-three',
    });

    await expect(result).resolves.toEqual({
      kind: 'tasks',
      listName: 'Sprint 14',
      sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: 'Livrer la connexion SSO.' },
      page: {
        items: [
          {
            key: 'CAD-482',
            name: 'Refondre l’écran de connexion SSO',
            status: 'progress',
            dueDate: '2026-11-12',
            assigneeCount: 1,
          },
        ],
        nextCursor: 'opaque-page-three',
      },
    });
  });

  it.each([
    { spaceId: '01923680-b800-7000-8000-000000000099', archivedAt: null },
    { spaceId: sprint.spaceId, archivedAt: '2026-11-17T08:00:00Z' },
  ])('does not read tasks from a mismatched or archived list', async (placement) => {
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    const result: Promise<SpacesPageData> = firstValueFrom(
      TestBed.inject(ListNavigation).load(sprint),
    );

    http.expectOne(`/v1/lists/${sprint.listId}`).flush(placement);

    await expect(result).rejects.toThrow('The selected list is unavailable in this space.');
    http.expectNone((request) => request.url === `/v1/lists/${sprint.listId}/tasks`);
  });
});
