import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LIST_DIRECTORY } from '@features/spaces/ports/list-directory';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import type { TaskDetailTask } from '../../../models/task-detail/task-detail.interface';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import { TaskDetailStore } from '../../../state/task-detail/task-detail.store';
import { TaskPropertiesStore } from '../../../state/task-properties/task-properties.store';
import { TaskStatusChangesStore } from '../../../state/task-status-changes/task-status-changes.store';
import { TaskTimeStore } from '../../../state/task-time/task-time.store';
import { defaultStatusOptions } from '../../../utils/task-status/task-status.util';
import { TaskPropertiesPanel } from './task-properties-panel.component';

/**
 * Function taskAt
 *
 * @description
 * CAD-482 of Sprint 14, with optional changes.
 *
 * @param {Partial<TaskDetailTask>} [changes] - Changed fields.
 * @returns {TaskDetailTask} The task.
 */
function taskAt(changes: Partial<TaskDetailTask> = {}): TaskDetailTask {
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
    version: 7,
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
 * Function terms
 *
 * @description
 * The row names of the panel, in order.
 *
 * @returns {string[]} The names.
 */
function terms(): string[] {
  return Array.from(document.querySelectorAll('dt')).map((term: Element) =>
    term.textContent.trim(),
  );
}

describe('TaskPropertiesPanel', () => {
  let fixture: ComponentFixture<TaskPropertiesPanel>;
  let task: WritableSignal<TaskDetailTask>;
  let canEdit: WritableSignal<boolean>;
  let update: Mock;
  let request: Mock;
  let toasts: { show: Mock; error: Mock };

  beforeEach(async () => {
    task = signal(taskAt());
    canEdit = signal(true);
    update = vi.fn(() => Promise.resolve(true));
    request = vi.fn();
    toasts = { show: vi.fn(), error: vi.fn() };
    const none: () => WritableSignal<null> = () => signal(null);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TaskDetailStore,
          useValue: {
            task,
            confirmedTask: task,
            canEdit,
            statuses: signal(defaultStatusOptions()),
            list: signal({
              id: 'sprint-14',
              name: 'Sprint 14',
              spaceId: 'product',
              canEdit: true,
              canComment: true,
            }),
            space: signal({ id: 'product', name: 'Product', statuses: defaultStatusOptions() }),
            update,
            moveTo: vi.fn(),
          },
        },
        {
          provide: TaskStatusChangesStore,
          useValue: {
            displayedStatus: (shown: TaskDetailTask) => shown.status,
            request,
            cancelRequest: signal(null),
            confirmCancel: vi.fn(),
            keepTask: vi.fn(),
          },
        },
        { provide: CwToastService, useValue: toasts },
        { provide: TaskDetailOpener, useValue: { open: vi.fn() } },
        { provide: LIST_DIRECTORY, useValue: { lists: signal([]) } },
        { provide: WORKSPACE_CONTEXT, useValue: { user: signal({ id: 'u1' }) } },
      ],
    });
    TestBed.overrideComponent(TaskPropertiesPanel, {
      set: {
        providers: [
          {
            provide: TaskPropertiesStore,
            useValue: {
              assigneeIds: signal(['u1']),
              people: signal([]),
              peopleFailed: signal(false),
              labels: signal(['Front']),
              labelOptions: signal(['Front']),
              labelsFailed: signal(false),
              sprintEnd: none(),
              watcherIds: signal(['u1']),
              watchersFailed: signal(false),
              approval: signal({ taskVersion: 7, reviewers: [] }),
              approvalFailed: signal(false),
              dependencies: signal([]),
              dependenciesFailed: signal(false),
              candidates: signal([]),
              candidatesLoading: signal(false),
              candidatesFailed: signal(false),
              statusTimes: signal({
                complete: true,
                durations: [{ status: 'progress', milliseconds: 7_200_000, active: true }],
              }),
            },
          },
          {
            provide: TaskTimeStore,
            useValue: {
              totalMinutes: signal(45),
              log: signal({ entries: [], totalMinutes: 45 }),
              failed: signal(false),
              pending: signal(false),
              timerStartedAt: none(),
            },
          },
        ],
      },
    });
    fixture = TestBed.createComponent(TaskPropertiesPanel);
    await fixture.whenStable();
  });

  it('lists every property of the task in the mockup order', () => {
    expect(terms()).toEqual([
      'Status',
      'Assignees',
      'Due date',
      'Priority',
      'Estimate',
      'Time spent',
      'Labels',
      'List',
      'Repeat',
      'Followers',
      'Milestone',
      'Approval',
      'Dependencies',
    ]);
    expect(document.body.textContent).toContain('Time in status');
    expect(document.body.textContent).toContain('1 / 3 done');
  });

  it('leaves out the estimate, the approval and the time in status for a milestone', async () => {
    task.set(taskAt({ milestone: true, status: 'todo', estimateMinutes: null }));
    await fixture.whenStable();

    expect(terms()).not.toContain('Estimate');
    expect(terms()).not.toContain('Approval');
    expect(document.body.textContent).not.toContain('Time in status');
  });

  it('advances the status through the status interaction', async () => {
    const advance: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>(
      '[data-testid="task-property-status"] button[aria-label^="Status:"]',
    );
    advance?.click();
    await fixture.whenStable();

    expect(request).toHaveBeenCalledWith(task(), 'review', defaultStatusOptions(), {
      quiet: false,
    });
  });

  it('applies a status picked from the menu without the change toast', async () => {
    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="task-property-status"] button[aria-haspopup="menu"]:last-of-type',
      )
      ?.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item: HTMLElement) => item.textContent.trim().startsWith('Blocked'))
      ?.click();
    await fixture.whenStable();

    expect(request).toHaveBeenCalledWith(task(), 'blocked', defaultStatusOptions(), {
      quiet: true,
    });
  });

  it('turns the task into a milestone and confirms it with a toast', async () => {
    document.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    await fixture.whenStable();

    expect(update).toHaveBeenCalledWith({ milestone: true });
    expect(toasts.show).toHaveBeenCalledWith('Marked as a milestone', {
      description: 'CAD-482 · Redesign the SSO sign-in screen',
    });
  });

  it('is read-only without the edit role', async () => {
    canEdit.set(false);
    await fixture.whenStable();

    expect(
      document.querySelector<HTMLButtonElement>('[data-testid="task-property-priority"]')?.disabled,
    ).toBe(true);
    expect(document.querySelector('[data-testid="task-property-timer"]')).toBeNull();
    expect(document.querySelector('[data-testid="task-property-dependency-add"]')).toBeNull();
  });
});
