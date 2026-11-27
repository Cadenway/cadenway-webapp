import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { By } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import type { StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors';
import { LIST_DIRECTORY, type ListDirectoryEntry } from '@features/spaces/ports/list-directory';
import {
  type CreatedTask,
  type Person,
  personOf,
  TaskCancelDialog,
  TaskCreate,
  TaskDetailOpener,
  TaskMenu,
  TaskRowActionsStore,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import {
  MyTasksApi,
  MyTasksPartialReadError,
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
 * A task of Camille Martin in Atelier Nord's `Sprint 14`, open and due on 12 November 2026 unless
 * the overrides say otherwise.
 *
 * @param {Partial<TaskSummary>} overrides - The fields that differ.
 * @returns {TaskSummary} The task.
 */
function myTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  const key: string = overrides.key ?? 'CAD-482';
  return {
    id: key,
    key,
    name: 'Review of the SSO flow',
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
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
    ...overrides,
  };
}

/**
 * Function pageOf
 *
 * @description
 * A complete read of one page holding the given tasks, the last one unless a next cursor is given.
 *
 * @param {readonly TaskSummary[]} tasks - The tasks.
 * @param {number} closed - The `Done` count.
 * @param {string | null} nextCursor - The page after it, if any.
 * @returns {MyTasksPageModel} The read.
 */
function pageOf(
  tasks: readonly TaskSummary[],
  closed: number = 2,
  nextCursor: string | null = null,
): MyTasksPageModel {
  return { tasks, counts: { open: tasks.length, closed }, complete: true, nextCursor, pages: 1 };
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
 * Constant organization
 *
 * @description
 * Atelier Nord.
 *
 * @type {WorkspaceOrganization}
 */
const organization: WorkspaceOrganization = {
  id: 'o-atelier-nord',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

describe('MyTasksPage', () => {
  let read: Mock<(tab: MyTasksTab, options: MyTasksReadOptions) => Promise<MyTasksPageModel>>;
  let changed: Subject<string>;
  let rowActions: Record<string, unknown> & {
    open: Mock;
    setStatus: Mock;
    sync: Mock;
    toggleAssignee: Mock;
    moveTo: Mock;
    askDelete: Mock;
    setDeleteOpen: Mock;
    trash: Mock;
    confirmCancel: Mock;
    keepCancel: Mock;
    hidden: WritableSignal<readonly string[]>;
    cancelKeys: WritableSignal<readonly string[] | null>;
    deleteOpen: WritableSignal<boolean>;
  };
  let people: Mock<() => Promise<readonly Person[]>>;
  let taskCreate: { created: Subject<CreatedTask>; open: Mock };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30));
    read = vi.fn((tab: MyTasksTab) =>
      Promise.resolve(
        tab === 'open'
          ? pageOf([
              myTask({ key: 'CAD-470', name: 'Fix the login redirect', due: '2026-11-10' }),
              myTask({ key: 'CAD-482' }),
              myTask({ key: 'CAD-475', name: 'Write the release notes', due: '2026-11-15' }),
              myTask({
                key: 'CAD-401',
                name: 'Archive the old flows',
                due: null,
                listId: 'l-sprint-12',
              }),
              myTask({
                key: 'DES-12',
                name: 'Draw the empty states',
                due: '2026-12-20',
                listId: 'l-research',
                spaceId: 'sp-design',
              }),
            ])
          : pageOf([myTask({ key: 'CAD-460', name: 'Ship the SSO screen', status: 'done' })], 1),
      ),
    );
    changed = new Subject<string>();
    const hidden: WritableSignal<readonly string[]> = signal<readonly string[]>([]);
    rowActions = {
      hidden,
      changed,
      userId: signal('u-camille'),
      cancelKeys: signal<readonly string[] | null>(null),
      deleteOpen: signal(false),
      deleting: signal(false),
      deleteTitle: signal('Delete “Fix the login redirect”?'),
      deleteText: signal('The task moves to the trash for 30 days.'),
      deleteAction: signal('Delete the task'),
      deleteItems: signal(['CAD-470 · Fix the login redirect']),
      sync: vi.fn(),
      rows: (tasks: readonly TaskSummary[]): readonly TaskSummary[] =>
        tasks.filter((task: TaskSummary): boolean => !hidden().includes(task.key)),
      displayedTask: (task: TaskSummary): TaskSummary => task,
      displayedStatus: (task: TaskSummary): StatusKey => task.status,
      open: vi.fn(),
      setStatus: vi.fn(),
      confirmCancel: vi.fn(),
      keepCancel: vi.fn(),
      setDeleteOpen: vi.fn(),
      trash: vi.fn(),
      toggleAssignee: vi.fn(),
      moveTo: vi.fn(),
      askDelete: vi.fn(),
    };
    people = vi.fn(() =>
      Promise.resolve([personOf('u-camille', 'Camille Martin'), personOf('u-ines', 'Inès Robert')]),
    );
    taskCreate = { created: new Subject<CreatedTask>(), open: vi.fn() };
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
                  providers: [{ provide: TaskRowActionsStore, useValue: rowActions }],
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
        {
          provide: MyTasksApi,
          useValue: { read, people },
        },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: signal(organization) } },
        { provide: LIST_DIRECTORY, useValue: { lists: signal([sprint]) } },
        {
          provide: TaskDetailOpener,
          useValue: { closed: new Subject<string>(), changed: new Subject<string>() },
        },
        { provide: TaskCreate, useValue: taskCreate },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function settle
   *
   * @description
   * Waits until the page or its error state rendered.
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
   * Opens an address of the page and waits until it rendered.
   *
   * @param {string} url - The address.
   * @returns {Promise<{ harness: RouterTestingHarness; element: HTMLElement }>} The harness and
   * its root element.
   */
  async function open(
    url: string,
  ): Promise<{ harness: RouterTestingHarness; element: HTMLElement }> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness);
    return { harness, element: harness.fixture.nativeElement as HTMLElement };
  }

  /**
   * Function groups
   *
   * @description
   * Each group's name with the task names of its lines.
   *
   * @param {HTMLElement} element - The page.
   * @returns {readonly string[]} One `Group: name, name` entry per group.
   */
  function groups(element: HTMLElement): readonly string[] {
    return Array.from(element.querySelectorAll('section')).map((section: HTMLElement) => {
      const names: string = Array.from(section.querySelectorAll('[data-testid="task-line-name"]'))
        .map((name: Element) => name.textContent.trim())
        .join(', ');
      return `${section.getAttribute('aria-label') ?? ''}: ${names}`;
    });
  }

  /**
   * Function menuOf
   *
   * @description
   * Opens the task menu on a line with a right click and returns it.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {number} index - The line, from the top.
   * @returns {Promise<TaskMenu>} The page's task menu.
   */
  async function menuOf(harness: RouterTestingHarness, index: number): Promise<TaskMenu> {
    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    const items: readonly Element[] = Array.from(element.querySelectorAll('li[tabindex]'));
    items
      .at(index)
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 8, clientY: 8 }));
    await settle(harness);
    return harness.fixture.debugElement.query(By.directive(TaskMenu)).componentInstance as TaskMenu;
  }

  /**
   * Function button
   *
   * @description
   * A button or tab by its text.
   *
   * @param {HTMLElement} element - The page.
   * @param {string} name - Its text, from its start.
   * @returns {HTMLElement | undefined} The control.
   */
  function button(element: HTMLElement, name: string): HTMLElement | undefined {
    return Array.from(element.querySelectorAll<HTMLElement>('button')).find(
      (control: HTMLElement) => control.textContent.trim().startsWith(name),
    );
  }

  it('groups the open tasks by due date, in the mockup order, with their counts', async () => {
    const { element }: { element: HTMLElement } = await open('/atelier-nord/my-tasks');

    expect(element.querySelector('h1')?.textContent.trim()).toBe('My tasks');
    expect(groups(element)).toEqual([
      'Late: Fix the login redirect',
      'Today: Review of the SSO flow',
      'Next seven days: Write the release notes',
      'Later: Draw the empty states',
      'No due date: Archive the old flows',
    ]);
    expect(
      Array.from(element.querySelectorAll('h2')).map((heading: Element) =>
        heading.textContent.replace(/\s+/gu, ' ').trim(),
      ),
    ).toEqual(['Late, 1', 'Today, 1', 'Next seven days, 1', 'Later, 1', 'No due date, 1']);
    const tablist: HTMLElement | null = element.querySelector('[role="tablist"]');
    expect(tablist?.getAttribute('aria-label')).toBe('Filter my tasks');
    expect(button(element, 'To do')?.textContent.replace(/\s+/gu, ' ').trim()).toBe('To do, 5');
    expect(button(element, 'Done')?.textContent.replace(/\s+/gu, ' ').trim()).toBe('Done, 2');
    expect(read).toHaveBeenCalledWith('open', expect.objectContaining({ passive: false }));
    expect(rowActions.sync).toHaveBeenCalledTimes(1);
  });

  it('labels as archived only a list missing from a space whose lists the sidebar holds', async () => {
    const { element }: { element: HTMLElement } = await open('/atelier-nord/my-tasks');

    const texts: readonly string[] = Array.from(element.querySelectorAll('cw-task-line')).map(
      (line: Element) => line.textContent.replace(/\s+/gu, ' '),
    );
    expect(texts[1]).toContain('Sprint 14');
    expect(texts[4]).toContain('Archived list');
    expect(texts[3]).toContain('Draw the empty states');
    expect(texts[3]).not.toContain('Archived list');
  });

  it('puts the selected tab content in its tab panel', async () => {
    const { element }: { element: HTMLElement } = await open('/atelier-nord/my-tasks');

    const panel: HTMLElement | null = element.querySelector('[role="tabpanel"]:not([hidden])');
    const tab: HTMLElement | null = element.querySelector('[role="tab"][aria-selected="true"]');
    expect(tab?.textContent).toContain('To do');
    expect(panel?.getAttribute('aria-labelledby')).toBe(tab?.id);
    expect(panel?.querySelectorAll('section')).toHaveLength(5);
    expect(element.querySelectorAll('[role="tabpanel"][hidden] section')).toHaveLength(0);
  });

  it('shows the closed tab from the address and switches tabs through it', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/my-tasks?tab=closed');

    expect(groups(element)).toEqual(['Done and cancelled: Ship the SSO screen']);
    expect(read).toHaveBeenCalledWith('closed', expect.objectContaining({ passive: false }));

    button(element, 'To do')?.click();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/atelier-nord/my-tasks');
    expect(groups(element)[0]).toBe('Late: Fix the login redirect');
  });

  it('opens a line in the task detail and creates a task from the header', async () => {
    const { element }: { element: HTMLElement } = await open('/atelier-nord/my-tasks');

    element.querySelector<HTMLButtonElement>('cw-task-line button')?.click();
    button(element, 'Create a task')?.click();

    expect(rowActions.open).toHaveBeenCalledWith(expect.objectContaining({ key: 'CAD-470' }));
    expect(taskCreate.open).toHaveBeenCalledTimes(1);
  });

  it('opens the task menu on a line and sends its status through the row writes', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/my-tasks');

    expect(element.querySelector('section')).not.toBeNull();
    const menu: TaskMenu = await menuOf(harness, 0);
    expect(menu.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-470']);
    menu.statusPicked.emit('done');

    expect(rowActions.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CAD-470' }),
      'done',
    );
  });

  it('reads the rows again once a write of the menu settled, keeping them meanwhile', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/my-tasks');

    changed.next('CAD-470');
    await settle(harness);

    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][1].passive).toBe(true);
    expect(groups(element)).toHaveLength(5);
  });

  it('shows a successful empty tab as empty, not as a failure', async () => {
    read.mockResolvedValueOnce(pageOf([], 0));
    const { element }: { element: HTMLElement } = await open('/atelier-nord/my-tasks');

    const empty: Element | null = element.querySelector('[data-testid="my-tasks-empty"]');
    expect(empty?.textContent).toContain('Nothing here');
    expect(empty?.textContent).toContain('No task in this tab.');
    expect(element.textContent).not.toContain('Could not load this page');
  });

  it('hands a failed first read to the error boundary, whose Retry reads again', async () => {
    read.mockRejectedValueOnce(new Error('unavailable'));
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/my-tasks?tab=closed');

    expect(element.querySelector('h1')?.textContent.trim()).toBe('Could not load this page');
    expect(element.querySelector('[data-testid="my-tasks-empty"]')).toBeNull();

    button(element, 'Retry')?.click();
    await settle(harness);

    expect(read).toHaveBeenCalledTimes(2);
    expect(groups(element)).toEqual(['Done and cancelled: Ship the SSO screen']);
  });

  it('keeps the rows read before a failed later page, with Retry', async () => {
    read.mockRejectedValueOnce(
      new MyTasksPartialReadError(
        { ...pageOf([myTask()]), complete: false, nextCursor: 'c2' },
        new Error('unavailable'),
      ),
    );
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/my-tasks');

    const partial: HTMLElement | null = element.querySelector('[data-testid="my-tasks-partial"]');
    expect(partial?.getAttribute('role')).toBe('alert');
    expect(partial?.textContent).toContain('Some of your tasks could not be loaded.');
    expect(groups(element)).toEqual(['Today: Review of the SSO flow']);

    button(element, 'Retry')?.click();
    await settle(harness);

    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][1].passive).toBe(false);
    expect(element.querySelector('[data-testid="my-tasks-partial"]')).toBeNull();
  });

  it('shows the skeleton while the first read runs', async () => {
    read.mockReturnValueOnce(new Promise<MyTasksPageModel>(() => undefined));
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/my-tasks');
    harness.detectChanges();
    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;

    const loading: HTMLElement | null = element.querySelector('[data-testid="my-tasks-loading"]');
    expect(loading?.getAttribute('aria-label')).toBe('Loading your tasks');
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('h1')?.textContent.trim()).toBe('My tasks');
    expect(element.querySelector('section')).toBeNull();
  });

  it('hides a line the menu deleted at once', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/my-tasks');

    rowActions.hidden.set(['CAD-470']);
    await settle(harness);

    expect(groups(element)[0]).toBe('Today: Review of the SSO flow');
  });

  it('reads the members on the first menu opening and assigns the person picked', async () => {
    const { harness }: { harness: RouterTestingHarness } = await open('/atelier-nord/my-tasks');
    expect(people).not.toHaveBeenCalled();

    const menu: TaskMenu = await menuOf(harness, 0);
    await settle(harness);

    expect(people).toHaveBeenCalledTimes(1);
    expect(menu.people().map((person: Person) => person.name)).toEqual([
      'Camille Martin',
      'Inès Robert',
    ]);
    menu.assigneeToggled.emit('u-ines');
    menu.assigneeToggled.emit('u-unknown');

    expect(rowActions.toggleAssignee).toHaveBeenCalledTimes(1);
    expect(rowActions.toggleAssignee).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CAD-470' }),
      expect.objectContaining({ id: 'u-ines', name: 'Inès Robert' }),
    );
  });

  it('moves the task of the menu to a list of the sidebar', async () => {
    const { harness }: { harness: RouterTestingHarness } = await open('/atelier-nord/my-tasks');

    const menu: TaskMenu = await menuOf(harness, 1);
    expect(menu.lists().map((list) => list.name)).toEqual(['Sprint 14']);
    menu.moved.emit('l-sprint-14');
    menu.moved.emit('l-gone');

    expect(rowActions.moveTo).toHaveBeenCalledTimes(1);
    expect(rowActions.moveTo).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CAD-482' }),
      expect.objectContaining({ listId: 'l-sprint-14', spaceName: 'Product' }),
    );
  });

  it('confirms a deletion of the menu in the alert dialog', async () => {
    const { harness }: { harness: RouterTestingHarness } = await open('/atelier-nord/my-tasks');

    const menu: TaskMenu = await menuOf(harness, 0);
    menu.deleteRequested.emit();
    expect(rowActions.askDelete).toHaveBeenCalledWith(expect.objectContaining({ key: 'CAD-470' }));

    rowActions.deleteOpen.set(true);
    await settle(harness);
    const dialog: HTMLElement | null = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('Delete “Fix the login redirect”?');
    Array.from(dialog?.querySelectorAll<HTMLElement>('button') ?? [])
      .find((control: HTMLElement) => control.textContent.trim() === 'Delete the task')
      ?.click();
    expect(rowActions.trash).toHaveBeenCalledTimes(1);

    Array.from(dialog?.querySelectorAll<HTMLElement>('button') ?? [])
      .find((control: HTMLElement) => control.textContent.trim() === 'Cancel')
      ?.click();
    await settle(harness);
    expect(rowActions.setDeleteOpen).toHaveBeenCalledWith(false);
  });

  it('binds the cancel reason dialog to the row writes', async () => {
    const { harness }: { harness: RouterTestingHarness } = await open('/atelier-nord/my-tasks');

    rowActions.cancelKeys.set(['CAD-470']);
    await settle(harness);
    const dialog: TaskCancelDialog = harness.fixture.debugElement.query(
      By.directive(TaskCancelDialog),
    ).componentInstance as TaskCancelDialog;
    expect(dialog.taskKeys()).toEqual(['CAD-470']);

    dialog.confirmed.emit({ reason: 'duplicate', note: '' });
    dialog.kept.emit();

    expect(rowActions.confirmCancel).toHaveBeenCalledWith({ reason: 'duplicate', note: '' });
    expect(rowActions.keepCancel).toHaveBeenCalledTimes(1);
  });

  it('adds the next Done page with Show more and says when it failed', async () => {
    read.mockImplementation((tab: MyTasksTab, options: MyTasksReadOptions) =>
      Promise.resolve(
        options.cursor === 'c2'
          ? pageOf([myTask({ key: 'CAD-455', name: 'Drop the beta flag', status: 'cancelled' })], 2)
          : pageOf(
              [myTask({ key: 'CAD-460', name: 'Ship the SSO screen', status: 'done' })],
              2,
              'c2',
            ),
      ),
    );
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/my-tasks?tab=closed');

    read.mockRejectedValueOnce(new Error('unavailable'));
    button(element, 'Show more')?.click();
    await settle(harness);
    expect(element.querySelector('[data-testid="my-tasks-more-failed"]')?.textContent).toContain(
      'The next tasks could not be loaded.',
    );
    expect(groups(element)).toEqual(['Done and cancelled: Ship the SSO screen']);

    button(element, 'Show more')?.click();
    await settle(harness);

    expect(read).toHaveBeenLastCalledWith(
      'closed',
      expect.objectContaining({ passive: false, cursor: 'c2', pages: 1 }),
    );
    expect(groups(element)).toEqual([
      'Done and cancelled: Ship the SSO screen, Drop the beta flag',
    ]);
    expect(button(element, 'Show more')).toBeUndefined();
    expect(element.querySelector('[data-testid="my-tasks-more-failed"]')).toBeNull();
  });
});
