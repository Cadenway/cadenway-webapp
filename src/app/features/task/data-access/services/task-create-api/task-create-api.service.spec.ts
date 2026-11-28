import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { STATUS_CATEGORY_BY_KEY, STATUS_KEYS, type StatusKey } from '@cadenway/contracts';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Person } from '../../../models/person/person.interface';
import type {
  CreatedTask,
  ListDestination,
  SpaceSetup,
  TaskDraft,
} from '../../../models/task-create/task-create.interface';
import { TaskCreateApi } from './task-create-api.service';

/**
 * Constant space
 *
 * @description
 * The Product space of Atelier Nord.
 *
 * @type {Record<string, unknown>}
 */
const space: Record<string, unknown> = {
  id: 'product',
  name: 'Product',
  prefix: 'CAD',
  description: null,
  icon: null,
  color: 'violet',
  visibility: 'organization',
  owner: { userId: 'u1' },
  statuses: Object.fromEntries(
    STATUS_KEYS.map((key: StatusKey) => [
      key,
      { category: STATUS_CATEGORY_BY_KEY[key], name: null, hidden: false },
    ]),
  ),
  nextKey: 'CAD-495',
  createdAt: '2026-11-01T10:00:00Z',
  version: 1,
};

/**
 * Function list
 *
 * @description
 * A list of the Product space.
 *
 * @param {string} id - Id of the list.
 * @param {string} name - Name of the list.
 * @returns {Record<string, unknown>} The list.
 */
function list(id: string, name: string): Record<string, unknown> {
  return {
    id,
    spaceId: 'product',
    name,
    icon: null,
    color: 'violet',
    sprint: null,
    createdAt: '2026-11-01T10:00:00Z',
    version: 1,
  };
}

/**
 * Constant draft
 *
 * @description
 * A minimal draft.
 *
 * @type {TaskDraft}
 */
const draft: TaskDraft = {
  name: 'Prepare the demo',
  description: '',
  status: 'todo',
  cancelReason: null,
  cancelNote: '',
  priority: 'moyenne',
  assigneeIds: ['u1'],
  due: null,
  labels: [],
  subtasks: ['Slides'],
  checklist: [],
};

describe('TaskCreateApi', () => {
  let http: HttpTestingController;
  let api: TaskCreateApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TaskCreateApi);
  });

  it('reads every page of spaces and of their lists', async () => {
    const answer: Promise<readonly ListDestination[]> = firstValueFrom(api.destinations());
    http
      .expectOne((request) => request.url === '/v1/spaces' && !request.params.has('cursor'))
      .flush({ items: [space], nextCursor: 'c2' });
    http
      .expectOne((request) => request.url === '/v1/spaces' && request.params.get('cursor') === 'c2')
      .flush({ items: [], nextCursor: null });
    http.expectOne('/v1/spaces/product/lists?limit=100').flush({
      items: [list('backlog', 'Backlog'), list('sprint-14', 'Sprint 14')],
      nextCursor: null,
    });

    await expect(answer).resolves.toEqual([
      {
        listId: 'backlog',
        listName: 'Backlog',
        spaceId: 'product',
        spaceName: 'Product',
        sprintEnd: null,
      },
      {
        listId: 'sprint-14',
        listName: 'Sprint 14',
        spaceId: 'product',
        spaceName: 'Product',
        sprintEnd: null,
      },
    ]);
    http.verify();
  });

  it('reads the next key and the statuses of a space without the cache', async () => {
    const answer: Promise<SpaceSetup> = firstValueFrom(api.space('product'));
    const request: TestRequest = http.expectOne('/v1/spaces/product');

    expect(request.request.cache).toBe('no-store');
    request.flush(space);
    const setup: SpaceSetup = await answer;
    expect(setup.nextKey).toBe('CAD-495');
    expect(setup.statuses).toHaveLength(10);
  });

  it('lists the members who can be assigned, guests left out', async () => {
    const answer: Promise<readonly Person[]> = firstValueFrom(api.people());
    const request: TestRequest = http.expectOne((r) => r.url === '/v1/members');

    expect(request.request.params.get('limit')).toBe('100');
    request.flush({
      items: [
        {
          id: 'm1',
          userId: 'u1',
          name: 'Camille Martin',
          email: 'camille.martin@ateliernord.fr',
          role: 'owner',
          joinedAt: '2026-11-01T10:00:00Z',
          version: 1,
        },
        {
          id: 'm9',
          userId: 'u9',
          name: 'Nora Guest',
          email: 'nora@studio.example',
          role: 'guest',
          joinedAt: '2026-11-02T10:00:00Z',
          version: 1,
        },
      ],
      nextCursor: null,
      total: 2,
      counts: { owner: 1, admin: 0, member: 0, guest: 1 },
    });
    await expect(answer).resolves.toEqual([
      { id: 'u1', name: 'Camille Martin', initials: 'CM', avatar: null },
    ]);
  });

  it('lists the label names', async () => {
    const answer: Promise<readonly string[]> = firstValueFrom(api.labels());
    http
      .expectOne((r) => r.url === '/v1/labels')
      .flush({ items: [{ name: 'Front' }, { name: 'Bug' }], nextCursor: null });

    await expect(answer).resolves.toEqual(['Front', 'Bug']);
  });

  it('lists the saved templates of a space', async () => {
    const answer: Promise<unknown> = firstValueFrom(api.templates('product'));
    http
      .expectOne((r) => r.url === '/v1/spaces/product/task-templates')
      .flush({ items: [], nextCursor: null });

    await expect(answer).resolves.toEqual([]);
  });

  it('creates a task with its Idempotency-Key', async () => {
    const answer: Promise<CreatedTask> = firstValueFrom(api.create('sprint-14', draft, 'k-1'));
    const request: TestRequest = http.expectOne('/v1/lists/sprint-14/tasks');

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('k-1');
    request.flush({ key: 'CAD-495', listId: 'sprint-14', status: 'todo' });
    await expect(answer).resolves.toEqual({
      key: 'CAD-495',
      listId: 'sprint-14',
      status: 'todo',
      subtasks: 1,
    });
  });

  it('creates a subtask under its parent', async () => {
    const answer: Promise<CreatedTask> = firstValueFrom(api.createSubtask('CAD-482', draft, 'k-1'));
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482/subtasks');

    expect(request.request.body).not.toHaveProperty('subtasks');
    expect(request.request.headers.get('Idempotency-Key')).toBe('k-1');
    request.flush({ key: 'CAD-496', listId: 'sprint-14', status: 'todo' });
    await expect(answer).resolves.toMatchObject({ key: 'CAD-496', subtasks: 0 });
  });
});
