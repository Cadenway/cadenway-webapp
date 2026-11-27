import {
  createEnvironmentInjector,
  EnvironmentInjector,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import {
  TaskVersionConflict,
  TaskWriteCancelled,
} from '../../models/task-write-error/task-write-error.model';
import {
  LANE_READ_TIMEOUT_MS,
  type TaskRowWriteLaneInstance,
  TaskRowWriteLaneStore,
} from './task-row-write-lane.store';

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
  let organization: WritableSignal<WorkspaceOrganization>;
  let page: EnvironmentInjector;

  /**
   * Function setup
   *
   * @description
   * Provides the lane in a page injector (destroyed to leave the page), with a faked task read
   * and workspace.
   *
   * @returns {TaskRowWriteLaneInstance} The lane.
   */
  function setup(): TaskRowWriteLaneInstance {
    const workspace: Partial<WorkspaceContextPort> = { organization };
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskApi, useValue: { read } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
    page = createEnvironmentInjector([TaskRowWriteLaneStore], TestBed.inject(EnvironmentInjector));
    return page.get(TaskRowWriteLaneStore);
  }

  beforeEach(() => {
    read = vi.fn(() => of(task));
    organization = signal({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
    } as WorkspaceOrganization);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('drops a queued write once the organization changed, before sending it', async () => {
    const lane: TaskRowWriteLaneInstance = setup();
    const idle: () => void = () => undefined;
    let release: () => void = idle;
    const first: Promise<void> = lane.write(
      'CAD-482',
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      3,
    );
    const send: Mock<(version: number) => Promise<void>> = vi.fn(() => Promise.resolve());
    const queued: Promise<void> = lane.write('CAD-482', send, 3);
    await vi.waitFor(() => {
      expect(release).not.toBe(idle);
    });

    const dropped: Promise<unknown> = queued.then(
      (): string => 'sent',
      (reason: unknown): unknown => reason,
    );
    organization.set({ id: 'o2', slug: 'other', name: 'Other' } as WorkspaceOrganization);
    release();
    await first;

    expect(await dropped).toBeInstanceOf(TaskWriteCancelled);
    expect(send).not.toHaveBeenCalled();
  });

  it('drops a write queued before the page was left, and sends one asked while leaving', async () => {
    const lane: TaskRowWriteLaneInstance = setup();
    const idle: () => void = () => undefined;
    let release: () => void = idle;
    const first: Promise<void> = lane.write(
      'CAD-482',
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      3,
    );
    const send: Mock<(version: number) => Promise<void>> = vi.fn(() => Promise.resolve());
    const queued: Promise<void> = lane.write('CAD-482', send, 3);
    await vi.waitFor(() => {
      expect(release).not.toBe(idle);
    });

    const dropped: Promise<unknown> = queued.then(
      (): string => 'sent',
      (reason: unknown): unknown => reason,
    );
    page.destroy();
    const flushed: Promise<void> = lane.write('CAD-482', send, 3);
    release();
    await first;

    expect(await dropped).toBeInstanceOf(TaskWriteCancelled);
    await flushed;
    expect(send).toHaveBeenCalledOnce();
  });

  it('gives up a read that never answers, so the next write is sent', async () => {
    vi.useFakeTimers();
    read.mockReturnValue(NEVER);
    const lane: TaskRowWriteLaneInstance = setup();

    const reading: Promise<unknown> = lane.reconcile('CAD-482');
    const send: Mock<(version: number) => Promise<void>> = vi.fn(() => Promise.resolve());
    const next: Promise<void> = lane.write('CAD-482', send, 3);
    await vi.advanceTimersByTimeAsync(LANE_READ_TIMEOUT_MS - 1);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(reading).resolves.toEqual({ kind: 'failed' });
    await next;
    expect(send).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('aborts a read in flight when the page is left', async () => {
    const teardown: Mock<() => void> = vi.fn();
    read.mockReturnValue(new Observable<TaskSummary>(() => teardown));
    const lane: TaskRowWriteLaneInstance = setup();

    const reading: Promise<unknown> = lane.reconcile('CAD-482');
    page.destroy();

    await expect(reading).resolves.toEqual({ kind: 'failed' });
    expect(teardown).toHaveBeenCalledOnce();
  });
});
