import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { TaskCreateApi } from '../../data-access/services/task-create-api/task-create-api.service';
import { TaskDetailApi } from '../../data-access/services/task-detail-api/task-detail-api.service';
import { TaskPropertyApi } from '../../data-access/services/task-property-api/task-property-api.service';
import type { Person } from '../../models/person/person.interface';
import type { TaskDetailTask } from '../../models/task-detail/task-detail.interface';
import type {
  TaskApproval,
  TaskDependency,
  TaskDependencyTask,
} from '../../models/task-property/task-property.interface';
import { personOf } from '../../utils/person/person.util';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import {
  CANDIDATE_DEBOUNCE_MS,
  TaskPropertiesStore,
  type TaskPropertiesStoreInstance,
} from './task-properties.store';

/**
 * Constant people
 *
 * @description
 * Members of Atelier Nord.
 *
 * @type {readonly Person[]}
 */
const people: readonly Person[] = [
  personOf('u1', 'Camille Martin'),
  personOf('u2', 'Inès Robert'),
  personOf('u3', 'Hugo Durand'),
];

/**
 * Function taskAt
 *
 * @description
 * CAD-482 of Sprint 14 at a version, with optional changes.
 *
 * @param {number} version - Its version.
 * @param {Partial<TaskDetailTask>} [changes] - Changed fields.
 * @returns {TaskDetailTask} The task.
 */
function taskAt(version: number, changes: Partial<TaskDetailTask> = {}): TaskDetailTask {
  return {
    id: 'CAD-482',
    key: 'CAD-482',
    name: 'Redesign the SSO sign-in screen',
    status: 'progress',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u1'],
    due: '2026-11-12',
    start: null,
    labels: ['Front'],
    subtasks: { closed: 1, total: 3 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'sprint-14',
    spaceId: 'product',
    version,
    description: null,
    cancelNote: null,
    estimateMinutes: 240,
    checklistItems: [],
    createdAt: '2026-11-02T09:00:00Z',
    createdBy: { type: 'user', id: 'u1' },
    updatedAt: '2026-11-06T09:00:00Z',
    archivedAt: null,
    ...changes,
  };
}

/**
 * Constant blocker
 *
 * @description
 * CAD-479, which blocks CAD-482.
 *
 * @type {TaskDependencyTask}
 */
const blocker: TaskDependencyTask = {
  key: 'CAD-479',
  name: 'Sliding sign-in counter',
  status: 'progress',
  milestone: false,
  due: '2026-11-10',
};

/**
 * Constant dependency
 *
 * @description
 * CAD-482 blocked by CAD-479.
 *
 * @type {TaskDependency}
 */
const dependency: TaskDependency = { id: 'd1', direction: 'blocked-by', task: blocker };

/**
 * Constant approval
 *
 * @description
 * Inès Robert approved; Hugo Durand waits.
 *
 * @type {TaskApproval}
 */
const approval: TaskApproval = {
  taskVersion: 7,
  reviewers: [
    { userId: 'u2', decision: 'approved' },
    { userId: 'u3', decision: null },
  ],
};

/**
 * Function settle
 *
 * @description
 * Lets the pending promises and timers of the store run.
 *
 * @param {number} [ms] - Time to wait.
 * @returns {Promise<void>} Resolves after the wait.
 */
async function settle(ms: number = 0): Promise<void> {
  await new Promise<void>((resolve: () => void) => setTimeout(resolve, ms));
  TestBed.tick();
}

describe('TaskPropertiesStore', () => {
  let store: TaskPropertiesStoreInstance;
  let task: WritableSignal<TaskDetailTask>;
  let detail: {
    taskKey: WritableSignal<string | null>;
    ready: WritableSignal<boolean>;
    task: WritableSignal<TaskDetailTask>;
    confirmedTask: WritableSignal<TaskDetailTask>;
    accept: Mock;
    acceptVersion: Mock;
    reload: Mock;
    reloadWatchers: Mock;
  };
  let api: Record<string, Mock>;
  let follow: Mock;
  let toasts: { show: Mock; error: Mock };

  beforeEach(() => {
    task = signal(taskAt(7));
    detail = {
      taskKey: signal<string | null>('CAD-482'),
      ready: signal(true),
      task,
      confirmedTask: task,
      accept: vi.fn(),
      acceptVersion: vi.fn(),
      reload: vi.fn(() => Promise.resolve()),
      reloadWatchers: vi.fn(() => Promise.resolve()),
    };
    api = {
      watchers: vi.fn(() => Promise.resolve(['u1', 'u2'])),
      approval: vi.fn(() => Promise.resolve(approval)),
      dependencies: vi.fn(() => Promise.resolve([dependency])),
      sprintEnd: vi.fn(() => Promise.resolve('2026-11-13')),
      statusTimes: vi.fn(() => Promise.resolve(null)),
      assign: vi.fn(() => Promise.resolve(taskAt(8, { assigneeIds: ['u1', 'u2'] }))),
      unassign: vi.fn(() => Promise.resolve(8)),
      label: vi.fn(() => Promise.resolve(taskAt(8, { labels: ['Front', 'Back'] }))),
      requestApproval: vi.fn(() =>
        Promise.resolve({ taskVersion: 8, reviewers: [{ userId: 'u2', decision: null }] }),
      ),
      addDependency: vi.fn(() => Promise.resolve({ dependency, version: 8 })),
      removeDependency: vi.fn(() => Promise.resolve(8)),
      candidates: vi.fn(() => Promise.resolve([blocker, { ...blocker, key: 'CAD-488' }])),
    };
    follow = vi.fn(() => Promise.resolve(8));
    toasts = { show: vi.fn(), error: vi.fn() };
    const workspace: Pick<WorkspaceContextPort, 'user'> = {
      user: signal({
        id: 'u1',
        name: 'Camille Martin',
        firstName: 'Camille',
        displayName: null,
        email: 'camille.martin@ateliernord.fr',
        initials: 'CM',
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        TaskPropertiesStore,
        { provide: TaskDetailStore, useValue: detail },
        { provide: TaskPropertyApi, useValue: api },
        { provide: TaskDetailApi, useValue: { follow } },
        {
          provide: TaskCreateApi,
          useValue: { people: () => of(people), labels: () => of(['Back', 'Front']) },
        },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
    store = TestBed.inject(TaskPropertiesStore);
    TestBed.tick();
  });

  it('reads the parts of the open task', async () => {
    await settle();

    expect(store.people()).toEqual(people);
    expect(store.watcherIds()).toEqual(['u1', 'u2']);
    expect(store.approval()).toEqual(approval);
    expect(store.dependencies()).toEqual([dependency]);
    expect(store.sprintEnd()).toBe('2026-11-13');
    expect(store.labelOptions()).toEqual(['Back', 'Front']);
  });

  it('keeps a failed read apart from an empty result', async () => {
    api['dependencies'].mockRejectedValueOnce(new Error('offline'));
    detail.taskKey.set('CAD-479');
    await settle();

    expect(store.dependencies()).toBeNull();
    expect(store.dependenciesFailed()).toBe(true);

    await store.reloadDependencies();

    expect(store.dependencies()).toEqual([dependency]);
    expect(store.dependenciesFailed()).toBe(false);
  });

  it('assigns at once and confirms the returned task', async () => {
    await settle();
    const write: Promise<void> = store.toggleAssignee('u2');

    expect(store.assigneeIds()).toEqual(['u1', 'u2']);
    await write;

    expect(api['assign']).toHaveBeenCalledWith('CAD-482', 'u2');
    expect(detail.accept).toHaveBeenCalledWith(taskAt(8, { assigneeIds: ['u1', 'u2'] }));
  });

  it('confirms an unassignment with the new version', async () => {
    await settle();
    await store.toggleAssignee('u1');

    expect(api['unassign']).toHaveBeenCalledWith('CAD-482', 'u1');
    expect(detail.accept).toHaveBeenCalledWith(taskAt(8, { assigneeIds: [] }));
  });

  it('puts the assignees back when the gateway refuses', async () => {
    await settle();
    api['assign'].mockRejectedValueOnce(new Error('refused'));
    await store.toggleAssignee('u3');

    expect(store.assigneeIds()).toEqual(['u1']);
    expect(toasts.error).toHaveBeenCalledWith(
      'Could not change the assignees',
      expect.objectContaining({ description: expect.any(String) as string }),
    );
  });

  it('adds a label at once and confirms the returned task', async () => {
    await settle();
    const write: Promise<void> = store.toggleLabel('Back');

    expect(store.labels()).toEqual(['Front', 'Back']);
    await write;

    expect(api['label']).toHaveBeenCalledWith('CAD-482', 'Back', true);
    expect(detail.accept).toHaveBeenCalled();
  });

  it('follows for someone else and puts the watchers back on a refusal', async () => {
    await settle();
    await store.toggleWatcher('u3');

    expect(follow).toHaveBeenCalledWith('CAD-482', 'u3', true);
    expect(store.watcherIds()).toEqual(['u1', 'u2', 'u3']);
    expect(detail.acceptVersion).toHaveBeenCalledWith(8);
    expect(detail.reloadWatchers).toHaveBeenCalled();

    follow.mockRejectedValueOnce(new Error('refused'));
    await store.toggleWatcher('u2');

    expect(store.watcherIds()).toEqual(['u1', 'u2', 'u3']);
    expect(toasts.error).toHaveBeenCalledWith('Could not change the followers', expect.anything());
  });

  it('starts a new approval round with the new reviewers against the task version', async () => {
    await settle();
    await store.toggleApprover('u3');

    expect(api['requestApproval']).toHaveBeenCalledWith('CAD-482', 7, ['u2']);
    expect(store.approval()?.reviewers).toEqual([{ userId: 'u2', decision: null }]);
    expect(detail.acceptVersion).toHaveBeenCalledWith(8);
  });

  it('never removes the last reviewer', async () => {
    api['approval'].mockResolvedValueOnce({
      taskVersion: 7,
      reviewers: [{ userId: 'u2', decision: null }],
    });
    detail.taskKey.set('CAD-479');
    await settle();
    await store.toggleApprover('u2');

    expect(api['requestApproval']).not.toHaveBeenCalled();
  });

  it('removes a dependency at once, and its toast Undo links the tasks again', async () => {
    await settle();
    const removal: Promise<boolean> = store.removeDependency(dependency);

    expect(store.dependencies()).toEqual([]);
    expect(await removal).toBe(true);
    const [title, options]: [string, CwToastOptions] = toasts.show.mock.calls[0] as [
      string,
      CwToastOptions,
    ];

    expect(title).toBe('Dependency removed');
    expect(options.description).toBe('CAD-479 no longer blocks CAD-482.');
    options.undo?.();
    await settle();

    expect(api['addDependency']).toHaveBeenCalledWith(
      'CAD-482',
      'CAD-479',
      'blocked-by',
      expect.any(String),
    );
    expect(store.dependencies()).toEqual([dependency]);
  });

  it('puts a dependency back when its removal is refused', async () => {
    await settle();
    api['removeDependency'].mockRejectedValueOnce(new Error('refused'));

    expect(await store.removeDependency(dependency)).toBe(false);
    expect(store.dependencies()).toEqual([dependency]);
    expect(toasts.error).toHaveBeenCalledWith(
      'Could not change the dependencies',
      expect.anything(),
    );
  });

  it('offers the candidates without the tasks already linked', async () => {
    await settle();
    store.searchCandidates('blocked-by', 'CAD', true);

    expect(api['candidates']).not.toHaveBeenCalled();
    await settle(CANDIDATE_DEBOUNCE_MS + 10);

    expect(api['candidates']).toHaveBeenCalledWith('CAD-482', 'blocked-by', 'CAD');
    expect(store.candidates().map((candidate: TaskDependencyTask) => candidate.key)).toEqual([
      'CAD-488',
    ]);
  });
});
