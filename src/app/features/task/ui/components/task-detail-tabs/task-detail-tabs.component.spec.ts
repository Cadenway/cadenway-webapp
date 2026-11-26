import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import type { CwMentionPerson, CwMentionSearch } from '@cadenway/ui/components/block-editor';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { TaskSectionsApi } from '../../../data-access/services/task-sections-api/task-sections-api.service';
import type {
  TaskCommentPage,
  TaskDetailTask,
} from '../../../models/task-detail/task-detail.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import { TaskDetailStore } from '../../../state/task-detail/task-detail.store';
import { TaskStatusChangesStore } from '../../../state/task-status-changes/task-status-changes.store';
import { defaultStatusOptions } from '../../../utils/task-status/task-status.util';
import { TaskDescription } from '../task-description/task-description.component';
import { TaskDetailTabs } from './task-detail-tabs.component';

/**
 * Constant TASK
 *
 * @description
 * CAD-482 of Sprint 14.
 *
 * @type {TaskDetailTask}
 */
const TASK: TaskDetailTask = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  status: 'progress',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u1'],
  due: null,
  start: null,
  labels: [],
  subtasks: { closed: 0, total: 1 },
  checklist: { closed: 0, total: 1 },
  comments: null,
  parentKey: null,
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'product',
  version: 4,
  description: null,
  cancelNote: null,
  estimateMinutes: null,
  checklistItems: [{ id: 'i1', text: 'Test on Safari', done: false }],
  createdAt: '2026-11-02T09:00:00Z',
  createdBy: { type: 'user', id: 'u1' },
  updatedAt: '2026-11-06T09:00:00Z',
  archivedAt: null,
};

/**
 * Constant SUBTASK
 *
 * @description
 * CAD-483, the subtask of CAD-482 in progress.
 *
 * @type {TaskSummary}
 */
const SUBTASK: TaskSummary = {
  ...TASK,
  id: 'CAD-483',
  key: 'CAD-483',
  name: 'Write the SSO error states',
  parentKey: 'CAD-482',
  subtasks: { closed: 0, total: 0 },
};

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

describe('TaskDetailTabs', () => {
  let comments: WritableSignal<TaskCommentPage | null>;
  let commentsFailed: WritableSignal<boolean>;
  let canComment: WritableSignal<boolean>;
  let detail: Record<string, unknown>;
  let api: Record<string, Mock>;
  let request: Mock;
  let open: Mock;
  let takeTab: Mock;
  let fixture: ComponentFixture<TaskDetailTabs>;

  /**
   * Function tab
   *
   * @description
   * A tab of the list by its name.
   *
   * @param {string} name - Start of its name.
   * @returns {HTMLElement} The tab.
   */
  function tab(name: string): HTMLElement {
    const found: HTMLElement | undefined = Array.from(
      document.querySelectorAll<HTMLElement>('[role="tab"]'),
    ).find((element: HTMLElement) => element.textContent.trim().startsWith(name));
    if (!found) throw new Error(`No tab ${name}`);
    return found;
  }

  /**
   * Function show
   *
   * @description
   * Selects a tab and lets the panel render.
   *
   * @param {string} name - Start of its name.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function show(name: string): Promise<void> {
    tab(name).click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    comments = signal<TaskCommentPage | null>({
      items: [
        {
          id: 'c1',
          author: { type: 'user', id: 'u2' },
          body: 'Export **ready** for review.',
          createdAt: '2026-11-06T09:00:00Z',
          editedAt: null,
          version: 1,
          replyToCommentId: null,
        },
      ],
      total: 1,
      nextCursor: null,
    });
    commentsFailed = signal(false);
    canComment = signal(true);
    detail = {
      taskKey: signal('CAD-482'),
      task: signal(TASK),
      confirmedTask: signal(TASK),
      canEdit: signal(true),
      canComment,
      statuses: signal(defaultStatusOptions()),
      subtasks: signal([SUBTASK]),
      comments,
      commentsFailed,
      commentsLoading: signal(false),
      commentsRevision: signal(0),
      update: vi.fn(() => Promise.resolve(true)),
      accept: vi.fn(),
      acceptVersion: vi.fn(),
      write: vi.fn((_key: string, send: (version: number) => Promise<unknown>, fallback?: number) =>
        send(fallback ?? 4),
      ),
      reload: vi.fn(() => Promise.resolve()),
      reloadComments: vi.fn(() => Promise.resolve()),
    };
    api = {
      people: vi.fn(() =>
        Promise.resolve([
          { id: 'u1', name: 'Camille Martin', initials: 'CM', avatar: null },
          { id: 'u2', name: 'Hugo Dubois', initials: 'HD', avatar: null },
        ]),
      ),
      parentOf: vi.fn(() => Promise.resolve(null)),
      approval: vi.fn(() =>
        Promise.resolve({ taskVersion: 4, taskStatus: 'progress', round: null }),
      ),
      listAttachments: vi.fn(() => Promise.resolve([])),
      participants: vi.fn(() => Promise.resolve(['u1', 'u2'])),
      activityPage: vi.fn(() =>
        Promise.resolve({
          total: 1,
          nextCursor: null,
          items: [
            {
              id: 'e1',
              at: '2026-11-06T09:00:00Z',
              actor: { type: 'git', id: 'github', provider: 'github' },
              change: { kind: 'status', from: 'progress', to: 'review' },
            },
          ],
        }),
      ),
    };
    request = vi.fn();
    open = vi.fn(() => Promise.resolve(true));
    takeTab = vi.fn(() => null);
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: TaskDetailStore, useValue: detail },
        {
          provide: TaskStatusChangesStore,
          useValue: { displayedStatus: (task: TaskSummary) => task.status, request },
        },
        { provide: TaskSectionsApi, useValue: api },
        { provide: TaskDetailOpener, useValue: { open, takeTab } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        {
          provide: CwToastService,
          useValue: { show: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
        },
      ],
    });
    fixture = TestBed.createComponent(TaskDetailTabs);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('names the tab list, selects Details and counts subtasks and comments', () => {
    expect(document.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe(
      'Task sections',
    );
    expect(tab('Details').getAttribute('aria-selected')).toBe('true');
    expect(tab('Subtasks').textContent).toContain('1');
    expect(tab('Comments').textContent).toContain('1');
    expect(document.querySelector('[data-testid="task-attachments"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="task-development"]')?.textContent).toContain(
      'No branch or pull request',
    );
    expect(document.querySelector('[data-testid="task-approval"]')).toBeNull();
    expect(takeTab).toHaveBeenCalledWith('CAD-482');
  });

  it('opens on the tab the opening asked for and focuses the new-subtask field', async () => {
    fixture.destroy();
    takeTab.mockReturnValue('subtasks');
    fixture = TestBed.createComponent(TaskDetailTabs);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();

    expect(tab('Subtasks').getAttribute('aria-selected')).toBe('true');
    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute('id')).toBe('task-subtask-new');
    });
  });

  it('offers the participants to the description mention menu', async () => {
    const description: TaskDescription = fixture.debugElement.query(By.directive(TaskDescription))
      .componentInstance as TaskDescription;
    const search: CwMentionSearch | null = description.mentionSearch();
    await vi.waitFor(() => {
      expect(api['people']).toHaveBeenCalled();
    });

    const people: readonly CwMentionPerson[] = search ? await firstValueFrom(search('hu')) : [];

    expect(api['participants']).toHaveBeenCalledExactlyOnceWith('CAD-482');
    expect(people).toEqual([{ id: 'u2', name: 'Hugo Dubois' }]);
  });

  it('disables the composer and reads no participants without the comment right', async () => {
    canComment.set(false);
    await show('Comments');

    expect(document.querySelector('[data-testid="task-comment-count"]')).toBeNull();
    expect(api['participants']).not.toHaveBeenCalled();
  });

  it('ticks a checklist item through its box', async () => {
    api['setChecklistItem'] = vi.fn(() => Promise.resolve({ ...TASK, version: 5 }));
    const box: HTMLElement | null = document.querySelector(
      '[aria-label="Complete: Test on Safari"]',
    );

    box?.click();
    await fixture.whenStable();

    expect(api['setChecklistItem']).toHaveBeenCalledWith('CAD-482', 'i1', true);
    expect(detail['write']).toHaveBeenCalledWith('CAD-482', expect.any(Function), 0);
  });

  it('opens a subtask with Enter and advances its status from its button', async () => {
    await show('Subtasks');
    const row: HTMLElement | null = document.querySelector('[data-testid="task-subtask"]');
    expect(row?.getAttribute('aria-label')).toBe('Open CAD-483 · Write the SSO error states');

    row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(open).toHaveBeenCalledWith('CAD-483', {
      key: 'CAD-483',
      name: 'Write the SSO error states',
      status: 'progress',
      milestone: false,
    });

    const advance: HTMLElement | null = document.querySelector(
      '[aria-label="In progress · move to “In review”"]',
    );
    advance?.click();
    expect(request).toHaveBeenCalledWith(SUBTASK, 'review', defaultStatusOptions());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('lists the comments with the composer, and the inline error with Retry', async () => {
    await show('Comments');
    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="task-comment"]')?.textContent).toContain(
        'Hugo Dubois',
      );
    });
    expect(document.querySelector('[data-testid="task-comment-count"]')?.textContent).toContain(
      '0 / 5,000',
    );
    expect(api['participants']).toHaveBeenCalledWith('CAD-482');

    comments.set(null);
    commentsFailed.set(true);
    await fixture.whenStable();
    const retry: HTMLButtonElement | undefined = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="alert"] button'),
    ).find((button: HTMLButtonElement) => button.textContent.includes('Retry'));
    retry?.click();
    expect(detail['reloadComments']).toHaveBeenCalled();
  });

  it('shows the empty comments state', async () => {
    comments.set({ items: [], total: 0, nextCursor: null });
    await show('Comments');

    expect(document.body.textContent).toContain('No comments');
  });

  it('reads the activity when its tab opens and names a Git actor', async () => {
    await show('Activity');

    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="task-activity"]')?.textContent).toContain(
        'GitHub changed the status to In review',
      );
    });
    expect(api['activityPage']).toHaveBeenCalledWith('CAD-482', null);
  });
});
