import { TestBed } from '@angular/core/testing';
import { type Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { type TaskRowWriteLaneInstance, TaskRowWriteLaneStore } from './task-row-write-lane.store';

/**
 * Constant task
 *
 * @description
 * CAD-482 of Sprint 14 as the gateway has it after another member's change, at version 7.
 *
 * @type {TaskSummary}
 */
const task: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  status: 'review',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u1'],
  due: null,
  start: null,
  labels: [],
  subtasks: { closed: 0, total: 0 },
  checklist: { closed: 0, total: 0 },
  comments: null,
  parentKey: null,
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'product',
  version: 7,
};

describe('TaskRowWriteLaneStore', () => {
  let read: Mock<(key: string) => Observable<TaskSummary>>;

  /**
   * Function setup
   *
   * @description
   * Provides the lane with a faked task read.
   *
   * @returns {TaskRowWriteLaneInstance} The lane.
   */
  function setup(): TaskRowWriteLaneInstance {
    TestBed.configureTestingModule({
      providers: [TaskRowWriteLaneStore, { provide: TaskApi, useValue: { read } }],
    });
    return TestBed.inject(TaskRowWriteLaneStore);
  }

  beforeEach(() => {
    read = vi.fn(() => of(task));
  });

  it('sends each write at the newer of the page copy and the version it adopted (+1)', async () => {
    const lane: TaskRowWriteLaneInstance = setup();
    const versions: number[] = [];

    await lane.write(
      'CAD-482',
      (version: number) => {
        versions.push(version);
        lane.acceptVersion(version + 1, {}, 'CAD-482');
        return Promise.resolve();
      },
      3,
    );
    await lane.write('CAD-482', (version: number) => Promise.resolve(versions.push(version)), 3);
    await lane.write('CAD-482', (version: number) => Promise.resolve(versions.push(version)), 6);

    expect(versions).toEqual([3, 4, 6]);
    expect(read).not.toHaveBeenCalled();
  });

  it('reads the task when a returned version skips one, and the next write waits for it', async () => {
    const lane: TaskRowWriteLaneInstance = setup();
    const reads: TaskSummary[] = [];
    lane.reads.subscribe((value: TaskSummary) => reads.push(value));

    await lane.write(
      'CAD-482',
      () => {
        lane.acceptVersion(6, {}, 'CAD-482');
        return Promise.resolve();
      },
      3,
    );
    const next: number = await lane.write(
      'CAD-482',
      (version: number) => Promise.resolve(version),
      3,
    );

    expect(read).toHaveBeenCalledExactlyOnceWith('CAD-482');
    expect(reads).toEqual([task]);
    expect(next).toBe(7);
  });

  it('reads the task again after a version conflict and rethrows it', async () => {
    const lane: TaskRowWriteLaneInstance = setup();

    await expect(
      lane.write('CAD-482', () => Promise.reject(new TaskVersionConflict('CAD-482')), 3),
    ).rejects.toBeInstanceOf(TaskVersionConflict);
    const next: number = await lane.write(
      'CAD-482',
      (version: number) => Promise.resolve(version),
      3,
    );

    expect(read).toHaveBeenCalledOnce();
    expect(next).toBe(7);
  });
});
