import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { TaskApprovalSnapshot } from '../../models/task-detail-sections/task-detail-sections.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import {
  TaskApprovalCardStore,
  type TaskApprovalCardStoreInstance,
} from './task-approval-card.store';

/**
 * Function snapshot
 *
 * @description
 * The approval of CAD-482 asked by Camille Martin of Hugo Dubois and Inès Robert.
 *
 * @param {number} version - Task version of the answer.
 * @param {'approved' | null} hugo - Hugo's vote.
 * @param {'approved' | null} ines - Inès's vote.
 * @returns {TaskApprovalSnapshot} The approval.
 */
function snapshot(
  version: number,
  hugo: 'approved' | null,
  ines: 'approved' | null,
): TaskApprovalSnapshot {
  const all: boolean = hugo === 'approved' && ines === 'approved';
  return {
    taskVersion: version,
    taskStatus: all ? 'done' : 'review',
    round: {
      id: 'r1',
      requesterId: 'u1',
      requestedAt: '2026-11-06T09:00:00Z',
      status: all ? 'approved' : 'pending',
      reviews: [
        { userId: 'u2', decision: hugo },
        { userId: 'u3', decision: ines },
      ],
    },
  };
}

describe('TaskApprovalCardStore', () => {
  let version: WritableSignal<number>;
  let detail: Record<string, unknown>;
  let api: Record<string, Mock>;
  let toasts: { success: Mock; error: Mock };
  let store: TaskApprovalCardStoreInstance;

  beforeEach(() => {
    version = signal(4);
    detail = {
      taskKey: signal('CAD-482'),
      confirmedTask: () => ({ key: 'CAD-482', status: 'review', version: version() }),
      reload: vi.fn(() => Promise.resolve()),
      reloadComments: vi.fn(() => Promise.resolve()),
      acceptVersion: vi.fn(),
      write: vi.fn((_key: string, send: (latest: number) => Promise<unknown>) => send(version())),
    };
    api = {
      approval: vi.fn(() => Promise.resolve(snapshot(4, null, null))),
      approve: vi.fn(),
      requestChanges: vi.fn(),
      withdrawVote: vi.fn(),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        TaskApprovalCardStore,
        { provide: TaskDetailStore, useValue: detail },
        { provide: TaskSectionsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(TaskApprovalCardStore);
  });

  it('reads the round once the detail is shown', async () => {
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.round()?.reviews).toHaveLength(2);
    });
    expect(api['approval']).toHaveBeenCalledTimes(1);
  });

  it('shows a failed read and reads again on Retry', async () => {
    api['approval'].mockRejectedValueOnce(new Error('offline'));
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.failed()).toBe(true);
    });

    await store.load();

    expect(store.failed()).toBe(false);
    expect(store.round()).not.toBeNull();
  });

  it('records an approval, takes the new version and says how many reviews remain', async () => {
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.round()).not.toBeNull();
    });
    api['approve'].mockResolvedValue(snapshot(5, 'approved', null));

    await expect(store.approve()).resolves.toBe(true);

    expect(detail['write']).toHaveBeenCalledWith('CAD-482', expect.any(Function));
    expect(api['approve']).toHaveBeenCalledWith('CAD-482', 'r1', 4);
    expect(detail['acceptVersion']).toHaveBeenCalledWith(5, { status: 'review' }, 'CAD-482');
    expect(toasts.success).toHaveBeenCalledWith('Approval recorded', {
      description: '1 review(s) still expected.',
    });
  });

  it('reads the detail again when the last approval moved the task to Done', async () => {
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.round()).not.toBeNull();
    });
    api['approve'].mockResolvedValue(snapshot(5, 'approved', 'approved'));

    await store.approve();

    expect(detail['reload']).toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledWith('Approved by all', {
      description: 'CAD-482 moves to Done.',
    });
  });

  it('keeps the card and toasts the failure when a vote is refused', async () => {
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.round()).not.toBeNull();
    });
    api['requestChanges'].mockRejectedValue(new Error('refused'));

    await expect(store.requestChanges('Use a semicolon')).resolves.toBe(false);

    expect(store.pending()).toBeNull();
    expect(store.round()?.reviews[0].decision).toBeNull();
    expect(toasts.error).toHaveBeenCalled();
  });

  it('sends a change request and a withdrawal against the newest confirmed version', async () => {
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.round()).not.toBeNull();
    });
    version.set(6);
    api['approval'].mockResolvedValue(snapshot(6, null, null));
    api['requestChanges'].mockResolvedValue({ ...snapshot(7, null, null), taskStatus: 'progress' });
    api['withdrawVote'].mockResolvedValue(8);

    await expect(store.requestChanges('Use a semicolon')).resolves.toBe(true);
    await expect(store.withdraw()).resolves.toBe(true);

    expect(api['requestChanges']).toHaveBeenCalledWith('CAD-482', 'r1', 'Use a semicolon', 6);
    expect(api['withdrawVote']).toHaveBeenCalledWith('CAD-482', 'r1', 6);
    expect(detail['acceptVersion']).toHaveBeenCalledWith(8, {}, 'CAD-482');
  });

  it('reads the approval again and says the task changed when a vote meets a 412', async () => {
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.round()).not.toBeNull();
    });
    api['approve'].mockRejectedValue(new TaskVersionConflict('CAD-482'));

    await expect(store.approve()).resolves.toBe(false);

    expect(toasts.error).toHaveBeenCalledWith('Could not record your review', {
      description: 'The task changed in the meantime; its latest version is shown.',
    });
    await vi.waitFor(() => {
      expect(api['approval']).toHaveBeenCalledTimes(2);
    });
  });

  it('reads the approval again when the task version moves past it', async () => {
    TestBed.tick();
    await vi.waitFor(() => {
      expect(api['approval']).toHaveBeenCalledTimes(1);
    });

    version.set(7);
    TestBed.tick();

    await vi.waitFor(() => {
      expect(api['approval']).toHaveBeenCalledTimes(2);
    });
  });
});
