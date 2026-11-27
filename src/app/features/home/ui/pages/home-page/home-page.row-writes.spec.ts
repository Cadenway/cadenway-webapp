import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TasksService } from '@cadenway/api-client';
import { provideCadenwayIcons } from '@cadenway/icons';
import { type CwToastOptions, CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors';
import { InboxDigest } from '@features/inbox';
import { LIST_DIRECTORY, type ListDirectoryEntry } from '@features/spaces/ports/list-directory';
import {
  TASK_ROW_ACTIONS_PROVIDERS,
  TaskActionsApi,
  type TaskBulkOutcome,
  TaskCreate,
  TaskDetailOpener,
  TaskMenu,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import {
  HomeApi,
  type HomeReadOptions,
} from '../../../data-access/services/home-api/home-api.service';
import type { HomeSnapshot } from '../../../models/home-read/home-read.interface';
import { HomePage } from './home-page.component';

/**
 * Function myTask
 *
 * @description
 * A task of Camille Martin in Atelier Nord's `Sprint 14`, of medium priority, as the page reads it.
 *
 * @param {string} key - Its key.
 * @param {string} name - Its name.
 * @returns {TaskSummary} The task.
 */
function myTask(key: string, name: string): TaskSummary {
  return {
    id: key,
    key,
    name,
    status: 'todo',
    cancelReason: null,
    priority: 'moyenne',
    assigneeIds: ['u-camille'],
    due: '2026-11-12',
    start: null,
    labels: [],
    subtasks: { closed: 0, total: 0 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'l-sprint-14',
    spaceId: 'sp-product',
    version: 3,
  };
}

/**
 * Function taskDto
 *
 * @description
 * A task as `getTask` returns it, for the reads back of the row writes.
 *
 * @param {TaskSummary} task - The task.
 * @returns {Record<string, unknown>} The DTO.
 */
function taskDto(task: TaskSummary): Record<string, unknown> {
  return {
    key: task.key,
    name: task.name,
    status: task.status,
    cancelReason: null,
    priority: task.priority,
    assignees: task.assigneeIds.map((userId: string) => ({ userId })),
    dueDate: task.due,
    startDate: null,
    labels: [],
    parentKey: null,
    listId: task.listId,
    spaceId: task.spaceId,
    subtaskCounts: { total: 0, closed: 0 },
    checklistCounts: { total: 0, done: 0 },
    milestone: false,
    recurrence: 'none',
    version: task.version,
  };
}

/**
 * Function applied
 *
 * @description
 * A bulk write the gateway applied to one task, at its next version.
 *
 * @param {string} taskKey - The task.
 * @param {string | null} trashEntryId - Its trash entry, for a deletion.
 * @returns {TaskBulkOutcome} The outcome.
 */
function applied(taskKey: string, trashEntryId: string | null = null): TaskBulkOutcome {
  return {
    affected: 1,
    done: [{ taskKey, version: trashEntryId ? null : 4, newTaskKey: null, trashEntryId }],
    failed: [],
    unknown: [],
    notSent: [],
  };
}

/**
 * Function homeOf
 *
 * @description
 * Camille Martin's home screen holding the given priorities, without sprint or list.
 *
 * @param {readonly TaskSummary[]} priorities - The priorities.
 * @returns {HomeSnapshot} The read.
 */
function homeOf(priorities: readonly TaskSummary[]): HomeSnapshot {
  return {
    stats: { assigned: priorities.length, late: 0, dueToday: priorities.length, done: 0 },
    priorities,
    sprint: null,
    lists: [],
  };
}

/**
 * Constant sprint
 *
 * @description
 * The `Sprint 14` list of the `Product` space, as the sidebar knows it.
 *
 * @type {ListDirectoryEntry}
 */
const sprint: ListDirectoryEntry = {
  id: 'l-sprint-14',
  name: 'Sprint 14',
  spaceId: 'sp-product',
  spaceName: 'Product',
  icon: 'phosphorRocketBold',
  tone: 'text-violet-text',
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
    id: 'u-camille',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o-atelier-nord',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: (): boolean => true,
};

/**
 * Component FakeInboxDigest
 *
 * @description
 * Stands for Inbox's digest, whose reads Inbox's own specs cover.
 */
@Component({ selector: 'cw-inbox-digest', template: '' })
class FakeInboxDigest {}

describe('HomePage with the task row writes', () => {
  let priorities: readonly TaskSummary[];
  let read: Mock<(today: string, options: HomeReadOptions) => Promise<HomeSnapshot>>;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let show: Mock<(title: string, options?: CwToastOptions) => string>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30));
    priorities = [
      myTask('CAD-470', 'Fix the login redirect'),
      myTask('CAD-482', 'Review of the SSO flow'),
      myTask('CAD-475', 'Write the release notes'),
    ];
    read = vi.fn(() => Promise.resolve(homeOf(priorities)));
    bulk = vi.fn<TaskActionsApi['bulk']>(() => Promise.resolve(applied('CAD-482')));
    show = vi.fn(() => 'toast-1');
    TestBed.overrideComponent(HomePage, {
      remove: { imports: [InboxDigest] },
      add: { imports: [FakeInboxDigest] },
    });
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: ':org',
              children: [
                {
                  path: '',
                  pathMatch: 'full',
                  component: HomePage,
                  providers: [TASK_ROW_ACTIONS_PROVIDERS],
                },
              ],
            },
          ],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        { provide: HomeApi, useValue: { read, people: vi.fn(() => Promise.resolve([])) } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: LIST_DIRECTORY, useValue: { lists: signal([sprint]) } },
        {
          provide: TaskDetailOpener,
          useValue: {
            closed: new Subject<string>(),
            changed: new Subject<string>(),
            open: vi.fn(),
          },
        },
        { provide: TaskCreate, useValue: { created: new Subject<unknown>(), open: vi.fn() } },
        {
          provide: TaskActionsApi,
          useValue: { bulk, remind: vi.fn(), restore: vi.fn(() => Promise.resolve()) },
        },
        {
          provide: TasksService,
          useValue: {
            getTask: (key: string) =>
              of(
                taskDto(
                  priorities.find((task: TaskSummary) => task.key === key) ?? myTask(key, 'Gone'),
                ),
              ),
          },
        },
        {
          provide: CwToastService,
          useValue: {
            show,
            error: vi.fn(() => 'toast-2'),
            warning: vi.fn(() => 'toast-3'),
            dismiss: vi.fn(),
            toasts: signal([]),
          },
        },
      ],
    });
    TestBed.inject(OrganizationPin).set('o-atelier-nord');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function open
   *
   * @description
   * Opens the home screen and waits until its priorities show.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => lines(harness).length).toBe(priorities.length);
    return harness;
  }

  /**
   * Function lines
   *
   * @description
   * The text of each priority line.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {readonly string[]} One entry per line.
   */
  function lines(harness: RouterTestingHarness): readonly string[] {
    harness.detectChanges();
    return Array.from(
      (harness.fixture.nativeElement as HTMLElement).querySelectorAll('cw-task-line'),
    ).map((line: Element) => line.textContent.replace(/\s+/gu, ' ').trim());
  }

  /**
   * Function openMenu
   *
   * @description
   * Opens the task menu on a line, as a right click does, and returns it.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {number} index - The line.
   * @returns {TaskMenu} The page's task menu.
   */
  function openMenu(harness: RouterTestingHarness, index: number): TaskMenu {
    Array.from((harness.fixture.nativeElement as HTMLElement).querySelectorAll('li[tabindex]'))
      .at(index)
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 8, clientY: 8 }));
    harness.detectChanges();
    return harness.fixture.debugElement.query(By.directive(TaskMenu)).componentInstance as TaskMenu;
  }

  /**
   * Function deleteLine
   *
   * @description
   * Deletes a line through the menu and its confirmation, the next read no longer holding it.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {number} index - The line.
   * @returns {Promise<void>} Resolves once the line left.
   */
  async function deleteLine(harness: RouterTestingHarness, index: number): Promise<void> {
    const key: string = priorities[index].key;
    bulk.mockImplementation(() => {
      priorities = priorities.filter((task: TaskSummary) => task.key !== key);
      return Promise.resolve(applied(key, 'trash-1'));
    });
    openMenu(harness, index).deleteRequested.emit();
    let confirm: HTMLButtonElement | undefined;
    await expect
      .poll(() => {
        harness.detectChanges();
        confirm = Array.from(
          document.body.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button'),
        ).find((button: HTMLButtonElement) => button.textContent.trim() === 'Delete the task');
        return confirm;
      })
      .toBeDefined();
    confirm?.click();
    await expect.poll(() => lines(harness).join(' | ')).not.toContain(key);
  }

  /**
   * Function focusedKey
   *
   * @description
   * The key of the line holding the focus, or the focused element's text.
   *
   * @returns {string | undefined} The key or the text.
   */
  function focusedKey(): string | undefined {
    const element: Element | null = document.activeElement;
    return (
      element?.closest('[data-task-key]')?.getAttribute('data-task-key') ??
      element?.textContent.trim()
    );
  }

  it('undoes a write started over a refused one back to the read value', async () => {
    let refuse: (outcome: TaskBulkOutcome) => void = (): void => undefined;
    bulk.mockImplementationOnce(
      () =>
        new Promise<TaskBulkOutcome>((resolve: (outcome: TaskBulkOutcome) => void): void => {
          refuse = resolve;
        }),
    );
    const harness: RouterTestingHarness = await open();

    openMenu(harness, 1).priorityPicked.emit('haute');
    await expect.poll(() => bulk.mock.calls.length).toBe(1);
    expect(lines(harness)[1]).toContain('High');
    openMenu(harness, 1).priorityPicked.emit('urgente');
    refuse({ affected: 0, done: [], failed: [{ taskKey: 'CAD-482' }], unknown: [], notSent: [] });

    await expect.poll(() => bulk.mock.calls.length).toBe(2);
    expect(bulk.mock.calls[1][1]).toEqual({ type: 'priority', priority: 'urgente' });
    await expect.poll(() => show.mock.calls.length).toBe(1);
    show.mock.calls[0][1]?.undo?.();

    await expect.poll(() => bulk.mock.calls.length).toBe(3);
    expect(bulk.mock.calls[2][1]).toEqual({ type: 'priority', priority: 'moyenne' });
  });

  it('gives the focus to the next line after a deletion', async () => {
    const harness: RouterTestingHarness = await open();

    await deleteLine(harness, 1);

    await expect.poll(focusedKey).toBe('CAD-475');
  });

  it('gives the focus to the previous line after deleting the last one', async () => {
    const harness: RouterTestingHarness = await open();

    await deleteLine(harness, 2);

    await expect.poll(focusedKey).toBe('CAD-482');
  });

  it('gives the focus to the empty paragraph once the only line is deleted', async () => {
    priorities = [myTask('CAD-470', 'Fix the login redirect')];
    const harness: RouterTestingHarness = await open();

    await deleteLine(harness, 0);

    await expect
      .poll(() => document.activeElement?.getAttribute('data-testid'))
      .toBe('home-priorities-empty');
  });
});
