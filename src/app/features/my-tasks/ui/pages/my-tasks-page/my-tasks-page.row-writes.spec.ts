import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TasksService, type UpdateTaskClientResult } from '@cadenway/api-client';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { type CwToastOptions, CwToastService } from '@cadenway/ui/components/toast';
import { type Observable, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors';
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
  MyTasksApi,
  type MyTasksReadOptions,
} from '../../../data-access/services/my-tasks-api/my-tasks-api.service';
import type {
  MyTasksPage as MyTasksPageModel,
  MyTasksTab,
} from '../../../models/my-tasks-read/my-tasks-read.interface';
import { MyTasksPage } from './my-tasks-page.component';

/**
 * Function myTask
 *
 * @description
 * Camille Martin's `CAD-470` of Atelier Nord's `Sprint 14`, late, as the page reads it.
 *
 * @param {Partial<TaskSummary>} overrides - The fields that differ.
 * @returns {TaskSummary} The task.
 */
function myTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: 'CAD-470',
    key: 'CAD-470',
    name: 'Fix the login redirect',
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u-camille'],
    due: '2026-11-10',
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
    ...overrides,
  };
}

/**
 * Function savedTask
 *
 * @description
 * The task as the gateway answers a write.
 *
 * @param {StatusKey} status - Its status.
 * @param {number} version - Its version.
 * @returns {UpdateTaskClientResult} The task.
 */
function savedTask(status: StatusKey, version: number): UpdateTaskClientResult {
  return {
    key: 'CAD-470',
    name: 'Fix the login redirect',
    status,
    cancelReason: null,
    priority: 'haute',
    assignees: [{ userId: 'u-camille' }],
    dueDate: '2026-11-10',
    startDate: null,
    labels: [],
    parentKey: null,
    listId: 'l-sprint-14',
    spaceId: 'sp-product',
    subtaskCounts: { closed: 0, total: 0 },
    checklistCounts: { done: 0, total: 0 },
    milestone: false,
    recurrence: 'none',
    version,
  } as Partial<UpdateTaskClientResult> as UpdateTaskClientResult;
}

/**
 * Function pageOf
 *
 * @description
 * A complete read of the `To do` tab holding one task.
 *
 * @param {TaskSummary} task - The task.
 * @returns {MyTasksPageModel} The read.
 */
function pageOf(task: TaskSummary): MyTasksPageModel {
  return {
    tasks: [task],
    counts: { open: 1, closed: 0 },
    complete: true,
    nextCursor: null,
    pages: 1,
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

describe('MyTasksPage with the task row writes', () => {
  let read: Mock<(tab: MyTasksTab, options: MyTasksReadOptions) => Promise<MyTasksPageModel>>;
  let updateTask: Mock<
    (key: string, body: { status: StatusKey }) => Observable<UpdateTaskClientResult>
  >;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let getTask: Mock<(key: string) => Observable<UpdateTaskClientResult>>;
  let show: Mock<(title: string, options?: CwToastOptions) => string>;
  let detailChanged: Subject<string>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30));
    read = vi.fn(() => Promise.resolve(pageOf(myTask())));
    updateTask = vi.fn((_key: string, body: { status: StatusKey }) =>
      of(savedTask(body.status, 4)),
    );
    bulk = vi.fn();
    getTask = vi.fn(() => of(savedTask('todo', 3)));
    show = vi.fn(() => 't1');
    detailChanged = new Subject<string>();
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: ':org',
              children: [
                {
                  path: 'my-tasks',
                  component: MyTasksPage,
                  errorComponent: RouteErrorBoundary,
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
        { provide: MyTasksApi, useValue: { read, people: vi.fn(() => Promise.resolve([])) } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: LIST_DIRECTORY, useValue: { lists: signal([sprint]) } },
        {
          provide: TaskDetailOpener,
          useValue: { closed: new Subject<string>(), changed: detailChanged, open: vi.fn() },
        },
        { provide: TaskCreate, useValue: { created: new Subject<unknown>(), open: vi.fn() } },
        {
          provide: TaskActionsApi,
          useValue: { bulk, remind: vi.fn(), restore: vi.fn() },
        },
        {
          provide: TasksService,
          useValue: { updateTask, getTask },
        },
        {
          provide: CwToastService,
          useValue: {
            show,
            error: vi.fn(() => 't2'),
            warning: vi.fn(() => 't3'),
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
   * Function settle
   *
   * @description
   * Waits until the page rendered.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once stable.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    for (let round: number = 0; round < 3; round += 1) {
      await harness.fixture.whenStable();
      harness.detectChanges();
    }
  }

  /**
   * Function open
   *
   * @description
   * Opens the page and the task menu of its line.
   *
   * @returns {Promise<{ harness: RouterTestingHarness; element: HTMLElement; menu: TaskMenu }>}
   * The harness, its root element and the menu.
   */
  async function open(): Promise<{
    harness: RouterTestingHarness;
    element: HTMLElement;
    menu: TaskMenu;
  }> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/my-tasks');
    await settle(harness);
    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    element
      .querySelector('li[tabindex]')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 8, clientY: 8 }));
    await settle(harness);
    const menu: TaskMenu = harness.fixture.debugElement.query(By.directive(TaskMenu))
      .componentInstance as TaskMenu;
    return { harness, element, menu };
  }

  /**
   * Function line
   *
   * @description
   * The text of the page's line.
   *
   * @param {HTMLElement} element - The page.
   * @returns {string} Its text, spaces collapsed.
   */
  function line(element: HTMLElement): string {
    return element.querySelector('cw-task-line')?.textContent.replace(/\s+/gu, ' ') ?? '';
  }

  /**
   * Function wait
   *
   * @description
   * Lets real time pass, past the 460 ms after which a status click is sent.
   *
   * @param {number} ms - Milliseconds.
   * @returns {Promise<void>} Resolves after them.
   */
  function wait(ms: number): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, ms);
    });
  }

  it('keeps a pending status over a reread, then reads the saved one again', async () => {
    const {
      harness,
      element,
      menu,
    }: { harness: RouterTestingHarness; element: HTMLElement; menu: TaskMenu } = await open();

    menu.statusPicked.emit('progress');
    await settle(harness);
    expect(line(element)).toContain('In progress');

    detailChanged.next('CAD-470');
    await settle(harness);
    expect(read).toHaveBeenCalledTimes(2);
    expect(line(element)).toContain('In progress');
    expect(updateTask).not.toHaveBeenCalled();

    read.mockResolvedValue(pageOf(myTask({ status: 'progress', version: 4 })));
    await wait(520);
    await settle(harness);

    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(updateTask.mock.calls[0][1]).toEqual({ status: 'progress' });
    expect(read.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(line(element)).toContain('In progress');
  });

  it('keeps a pending priority over a reread of the older copy', async () => {
    let release: (outcome: TaskBulkOutcome) => void = (): void => undefined;
    bulk.mockReturnValueOnce(
      new Promise<TaskBulkOutcome>((resolve: (outcome: TaskBulkOutcome) => void): void => {
        release = resolve;
      }),
    );
    const {
      harness,
      element,
      menu,
    }: { harness: RouterTestingHarness; element: HTMLElement; menu: TaskMenu } = await open();

    menu.priorityPicked.emit('urgente' satisfies PriorityKey);
    await settle(harness);
    expect(line(element)).toContain('Urgent');

    detailChanged.next('CAD-470');
    await settle(harness);
    expect(read).toHaveBeenCalledTimes(2);
    expect(line(element)).toContain('Urgent');

    read.mockResolvedValue(pageOf(myTask({ priority: 'urgente', version: 4 })));
    release({
      affected: 1,
      done: [{ taskKey: 'CAD-470', version: 4, newTaskKey: null, trashEntryId: null }],
      failed: [],
      unknown: [],
      notSent: [],
    });
    await settle(harness);
    await settle(harness);

    expect(read.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(line(element)).toContain('Urgent');
  });

  it('asks the cancel reason first and changes nothing when the task is kept', async () => {
    const {
      harness,
      element,
      menu,
    }: { harness: RouterTestingHarness; element: HTMLElement; menu: TaskMenu } = await open();

    menu.statusPicked.emit('cancelled');
    await settle(harness);
    const dialog: HTMLElement | null = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('CAD-470');
    Array.from(dialog?.querySelectorAll<HTMLElement>('button') ?? [])
      .find((control: HTMLElement) => control.textContent.trim() === 'Keep the task')
      ?.click();
    await settle(harness);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(line(element)).toContain('To do');
    await wait(520);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('undoes a write picked over a refused one back to the read value, not the pending one', async () => {
    read.mockResolvedValue(pageOf(myTask({ priority: 'moyenne' })));
    getTask.mockReturnValue(of({ ...savedTask('todo', 3), priority: 'moyenne' }));
    let refuse: (outcome: TaskBulkOutcome) => void = (): void => undefined;
    bulk.mockReturnValueOnce(
      new Promise<TaskBulkOutcome>((resolve: (outcome: TaskBulkOutcome) => void): void => {
        refuse = resolve;
      }),
    );
    bulk.mockResolvedValue({
      affected: 1,
      done: [{ taskKey: 'CAD-470', version: 4, newTaskKey: null, trashEntryId: null }],
      failed: [],
      unknown: [],
      notSent: [],
    });
    const {
      harness,
      element,
      menu,
    }: { harness: RouterTestingHarness; element: HTMLElement; menu: TaskMenu } = await open();

    menu.priorityPicked.emit('haute' satisfies PriorityKey);
    await expect.poll(() => bulk.mock.calls.length).toBe(1);
    element
      .querySelector('li[tabindex]')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 8, clientY: 8 }));
    await settle(harness);
    expect(menu.tasks()[0]?.priority).toBe('haute');
    menu.priorityPicked.emit('urgente' satisfies PriorityKey);
    refuse({ affected: 0, done: [], failed: [{ taskKey: 'CAD-470' }], unknown: [], notSent: [] });

    await expect.poll(() => bulk.mock.calls.length).toBe(2);
    expect(bulk.mock.calls[1][1]).toEqual({ type: 'priority', priority: 'urgente' });
    await expect.poll(() => show.mock.calls.length).toBe(1);
    show.mock.calls[0][1]?.undo?.();

    await expect.poll(() => bulk.mock.calls.length).toBe(3);
    expect(bulk.mock.calls[2][1]).toEqual({ type: 'priority', priority: 'moyenne' });
  });
});
