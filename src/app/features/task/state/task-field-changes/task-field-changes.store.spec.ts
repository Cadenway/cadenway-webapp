import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { TaskFieldChangesStore } from './task-field-changes.store';

/**
 * Constant task
 *
 * @description
 * CAD-482 of Sprint 14, high priority, assigned to Camille Martin, at version 3.
 *
 * @type {TaskSummary}
 */
const task: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  status: 'todo',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u-camille'],
  due: '2026-11-12',
  start: null,
  labels: ['Front'],
  subtasks: { closed: 0, total: 0 },
  checklist: { closed: 0, total: 0 },
  comments: null,
  parentKey: null,
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'produit',
  version: 3,
};

describe('TaskFieldChangesStore', () => {
  let api: {
    changePriority: Mock<TaskApi['changePriority']>;
    assign: Mock<TaskApi['assign']>;
    unassign: Mock<TaskApi['unassign']>;
    read: Mock<TaskApi['read']>;
  };
  let toasts: { error: Mock; warning: Mock };

  /**
   * Function setup
   *
   * @description
   * Provides the store with the faked task data access and toasts.
   *
   * @returns {InstanceType<typeof TaskFieldChangesStore>} The store.
   */
  function setup(): InstanceType<typeof TaskFieldChangesStore> {
    TestBed.configureTestingModule({
      providers: [
        TaskFieldChangesStore,
        { provide: TaskApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    return TestBed.inject(TaskFieldChangesStore);
  }

  beforeEach(() => {
    api = {
      changePriority: vi.fn<TaskApi['changePriority']>((_key, version, priority) =>
        of({ ...task, priority, version: version + 1 }),
      ),
      assign: vi.fn<TaskApi['assign']>((_key, version) => of({ ...task, version: version + 1 })),
      unassign: vi.fn<TaskApi['unassign']>((_key, version) => of(version + 1)),
      read: vi.fn<TaskApi['read']>(() => of({ ...task, priority: 'basse', version: 9 })),
    };
    toasts = { error: vi.fn(), warning: vi.fn() };
  });

  it('shows an edit at once and chains the writes of one task on the returned versions', () => {
    const store: InstanceType<typeof TaskFieldChangesStore> = setup();
    const first: Subject<TaskSummary> = new Subject<TaskSummary>();
    api.changePriority.mockReturnValueOnce(first);

    store.edit(task, { priority: 'urgente' });
    store.edit(task, { assigneeIds: ['u-ines'] });

    expect(store.displayed(task)).toMatchObject({ priority: 'urgente', assigneeIds: ['u-ines'] });
    expect(api.changePriority).toHaveBeenCalledExactlyOnceWith('CAD-482', 3, 'urgente');
    expect(api.assign).not.toHaveBeenCalled();

    first.next({ ...task, priority: 'urgente', version: 4 });
    first.complete();

    expect(api.assign).toHaveBeenCalledExactlyOnceWith('CAD-482', 4, 'u-ines');
    expect(api.unassign).toHaveBeenCalledExactlyOnceWith('CAD-482', 5, 'u-camille');
    expect(store.displayed(task)).toMatchObject({
      priority: 'urgente',
      assigneeIds: ['u-ines'],
      version: 6,
    });
    expect(store.displayed({ ...task, priority: 'urgente', version: 6 }).assigneeIds).toEqual(
      task.assigneeIds,
    );
  });

  it('restores the value a refused edit replaced and shows the failure toast', () => {
    api.changePriority.mockReturnValueOnce(throwError(() => new Error('503')));
    const store: InstanceType<typeof TaskFieldChangesStore> = setup();

    store.edit(task, { priority: 'urgente' });

    expect(store.displayed(task).priority).toBe('haute');
    expect(toasts.error).toHaveBeenCalledWith(
      'Impossible d’enregistrer la modification',
      expect.anything(),
    );
  });

  it('reads the task again after a conflict and hands it back', () => {
    api.changePriority.mockReturnValueOnce(throwError(() => new TaskVersionConflict('CAD-482')));
    const store: InstanceType<typeof TaskFieldChangesStore> = setup();
    const refreshed: TaskSummary[] = [];
    store.refreshed.subscribe((fresh: TaskSummary) => refreshed.push(fresh));

    store.edit(task, { priority: 'urgente' });

    expect(api.read).toHaveBeenCalledExactlyOnceWith('CAD-482');
    expect(refreshed).toEqual([{ ...task, priority: 'basse', version: 9 }]);
    expect(store.displayed(refreshed[0]).priority).toBe('basse');
    expect(toasts.warning).toHaveBeenCalledWith('CAD-482 modifiée ailleurs', expect.anything());
  });

  it('sends nothing when the edit keeps the shown values', () => {
    const store: InstanceType<typeof TaskFieldChangesStore> = setup();

    store.edit(task, { priority: 'haute', assigneeIds: ['u-camille'] });

    expect(api.changePriority).not.toHaveBeenCalled();
    expect(api.assign).not.toHaveBeenCalled();
  });
});
