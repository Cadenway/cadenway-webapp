import { TestBed } from '@angular/core/testing';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TaskCreateApi } from '../../data-access/services/task-create-api/task-create-api.service';
import type {
  CreatedTask,
  ListDestination,
  SpaceSetup,
  TaskDraft,
} from '../../models/task-create/task-create.interface';
import { TaskCreateStore } from './task-create.store';

/**
 * Constant destinations
 *
 * @description
 * Backlog of Produit and Campagnes of Marketing.
 *
 * @type {readonly ListDestination[]}
 */
const destinations: readonly ListDestination[] = [
  {
    listId: 'backlog',
    listName: 'Backlog',
    spaceId: 'produit',
    spaceName: 'Produit',
    sprintEnd: null,
  },
  {
    listId: 'campagnes',
    listName: 'Campagnes',
    spaceId: 'marketing',
    spaceName: 'Marketing',
    sprintEnd: null,
  },
];

/**
 * Constant draft
 *
 * @description
 * A minimal draft.
 *
 * @type {TaskDraft}
 */
const draft: TaskDraft = {
  name: 'Préparer la démo',
  description: '',
  status: 'todo',
  cancelReason: null,
  cancelNote: '',
  priority: 'moyenne',
  assigneeIds: [],
  due: null,
  labels: [],
  subtasks: [],
  checklist: [],
};

/**
 * Function setup
 *
 * @description
 * Provides the store with a faked data access.
 *
 * @param {Partial<Record<keyof TaskCreateApi, Mock>>} overrides - Replaced operations.
 * @returns {{ store: InstanceType<typeof TaskCreateStore>; space: Mock<(id: string) => Observable<SpaceSetup>> }} The store and the space read.
 */
function setup(overrides: Partial<Record<keyof TaskCreateApi, Mock>> = {}): {
  store: InstanceType<typeof TaskCreateStore>;
  space: Mock<(id: string) => Observable<SpaceSetup>>;
} {
  const space: Mock<(id: string) => Observable<SpaceSetup>> = vi.fn((spaceId: string) =>
    of({ spaceId, nextKey: spaceId === 'produit' ? 'CAD-495' : 'MKT-12', statuses: [] }),
  );
  TestBed.configureTestingModule({
    providers: [
      TaskCreateStore,
      {
        provide: TaskCreateApi,
        useValue: {
          destinations: vi.fn(() => of(destinations)),
          space,
          templates: vi.fn(() => of([])),
          people: vi.fn(() => of([])),
          labels: vi.fn(() => of([])),
          create: vi.fn(() =>
            of({ key: 'CAD-495', listId: 'backlog', status: 'todo', subtasks: 0 }),
          ),
          createSubtask: vi.fn(),
          ...overrides,
        },
      },
    ],
  });
  return { store: TestBed.inject(TaskCreateStore), space };
}

describe('TaskCreateStore', () => {
  it('exposes failed secondary reads and retries them independently', async () => {
    const people: Mock = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of([]));
    const labels: Mock = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of([]));
    const templates: Mock = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of([]));
    const space: Mock = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of({ spaceId: 'produit', nextKey: null, statuses: [] }));
    const { store }: ReturnType<typeof setup> = setup({ people, labels, templates, space });
    store.activate(null);
    await vi.waitFor(() => {
      expect(store.peopleFailed()).toBe(true);
      expect(store.labelsFailed()).toBe(true);
      expect(store.templatesFailed()).toBe(true);
      expect(store.spaceFailed()).toBe(true);
    });
    store.retrySecondary('people');
    store.retrySecondary('labels');
    store.retrySecondary('templates');
    store.retrySecondary('space');
    await vi.waitFor(() => {
      expect(store.peopleFailed()).toBe(false);
      expect(store.labelsFailed()).toBe(false);
      expect(store.templatesFailed()).toBe(false);
      expect(store.spaceFailed()).toBe(false);
    });
  });
  it('reads nothing until the dialog opens, then the first list and its space', async () => {
    const { store, space }: ReturnType<typeof setup> = setup();
    TestBed.tick();
    expect(space).not.toHaveBeenCalled();

    store.activate(null);
    await vi.waitFor(() => {
      expect(store.nextKey()).toBe('CAD-495');
    });
    expect(store.destination()?.listId).toBe('backlog');
  });

  it('follows the chosen list to its space', async () => {
    const { store }: ReturnType<typeof setup> = setup();
    store.activate('campagnes');
    await vi.waitFor(() => {
      expect(store.nextKey()).toBe('MKT-12');
    });
    store.chooseList('backlog');
    await vi.waitFor(() => {
      expect(store.nextKey()).toBe('CAD-495');
    });
  });

  it('flags a failed read of the lists and retries it', async () => {
    const destinationsRead: Mock = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('503')))
      .mockReturnValue(of(destinations));
    const { store }: ReturnType<typeof setup> = setup({ destinations: destinationsRead });
    store.activate(null);
    await vi.waitFor(() => {
      expect(store.destinationsFailed()).toBe(true);
    });
    expect(store.destinations()).toEqual([]);

    store.retry();
    await vi.waitFor(() => {
      expect(store.destinations()).toHaveLength(2);
    });
    expect(store.destinationsFailed()).toBe(false);
  });

  it('reuses the Idempotency-Key for the same body and reads the next key after a creation', async () => {
    const create: Mock<(listId: string, value: TaskDraft, key: string) => Observable<CreatedTask>> =
      vi
        .fn<(listId: string, value: TaskDraft, key: string) => Observable<CreatedTask>>()
        .mockReturnValueOnce(throwError(() => new Error('503')))
        .mockReturnValue(of({ key: 'CAD-495', listId: 'backlog', status: 'todo', subtasks: 0 }));
    const { store, space }: ReturnType<typeof setup> = setup({ create });
    store.activate(null);
    await vi.waitFor(() => {
      expect(store.nextKey()).toBe('CAD-495');
    });

    await expect(store.create(draft, null)).rejects.toThrow('503');
    expect(store.creating()).toBe(false);
    await expect(store.create(draft, null)).resolves.toMatchObject({ key: 'CAD-495' });
    expect(create.mock.calls[1][2]).toBe(create.mock.calls[0][2]);
    await vi.waitFor(() => {
      expect(space).toHaveBeenCalledTimes(2);
    });

    create.mockClear();
    await store.create({ ...draft, name: 'Autre' }, null);
    await store.create({ ...draft, name: 'Encore' }, null);
    expect(create.mock.calls[0][2]).not.toBe(create.mock.calls[1][2]);
  });

  it('replaces an unresolved key when the body or organization changes', async () => {
    const create: Mock<(listId: string, value: TaskDraft, key: string) => Observable<CreatedTask>> =
      vi.fn(() => throwError(() => new Error('offline')));
    const { store }: ReturnType<typeof setup> = setup({ create });
    store.reset('org-one');
    store.activate(null);
    await vi.waitFor(() => {
      expect(store.destination()?.listId).toBe('backlog');
    });
    await expect(store.create(draft, null)).rejects.toThrow('offline');
    await expect(store.create({ ...draft, name: 'Changed' }, null)).rejects.toThrow('offline');
    expect(create.mock.calls[1][2]).not.toBe(create.mock.calls[0][2]);
    store.reset('org-two');
    store.activate(null);
    await vi.waitFor(() => {
      expect(store.destination()?.listId).toBe('backlog');
    });
    await expect(store.create({ ...draft, name: 'Changed' }, null)).rejects.toThrow('offline');
    expect(create.mock.calls[2][2]).not.toBe(create.mock.calls[1][2]);
  });

  it('keeps a newer retry in flight when an earlier submission settles', async () => {
    const first: Subject<CreatedTask> = new Subject<CreatedTask>();
    const second: Subject<CreatedTask> = new Subject<CreatedTask>();
    const create: Mock<(listId: string, value: TaskDraft, key: string) => Observable<CreatedTask>> =
      vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { store }: ReturnType<typeof setup> = setup({ create });
    store.activate(null);
    await vi.waitFor(() => {
      expect(store.destination()?.listId).toBe('backlog');
    });
    const original: Promise<CreatedTask> = store.create(draft, null);
    store.activate(null);
    const retry: Promise<CreatedTask> = store.create(draft, null);
    expect(create.mock.calls[1][2]).toBe(create.mock.calls[0][2]);
    const created: CreatedTask = { key: 'CAD-495', listId: 'backlog', status: 'todo', subtasks: 0 };
    first.next(created);
    await original;
    expect(store.creating()).toBe(true);
    second.next(created);
    await retry;
    expect(store.creating()).toBe(false);
  });
});
