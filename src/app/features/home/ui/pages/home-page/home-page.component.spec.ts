import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors';
import { InboxDigest } from '@features/inbox';
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
  HomeApi,
  type HomeReadOptions,
} from '../../../data-access/services/home-api/home-api.service';
import type { HomeSnapshot } from '../../../models/home-read/home-read.interface';
import { HomePage } from './home-page.component';

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
 * Constant camilleHome
 *
 * @description
 * Camille Martin's home screen in Atelier Nord: two late or due priorities (one in an archived
 * list), one in a space the sidebar has not read, `Sprint 14` current and two lists.
 *
 * @type {HomeSnapshot}
 */
const camilleHome: HomeSnapshot = {
  stats: { assigned: 9, late: 2, dueToday: 1, done: 31 },
  priorities: [
    myTask({ key: 'CAD-470', name: 'Fix the login redirect', due: '2026-11-10' }),
    myTask({ key: 'CAD-482' }),
    myTask({ key: 'CAD-401', name: 'Archive the old flows', listId: 'l-sprint-12' }),
    myTask({
      key: 'DES-12',
      name: 'Draw the empty states',
      listId: 'l-research',
      spaceId: 'sp-design',
    }),
  ],
  sprint: {
    listId: 'l-sprint-14',
    name: 'Sprint 14',
    startDate: '2026-11-03',
    endDate: '2026-11-17',
    done: 12,
    live: 32,
  },
  lists: [
    { id: 'l-sprint-14', name: 'Sprint 14', spaceId: 'sp-product', open: 14 },
    { id: 'l-research', name: 'Research', spaceId: 'sp-design', open: 4 },
  ],
};

/**
 * Constant emptyHome
 *
 * @description
 * The home screen of a new organization: nothing assigned, no sprint, no list.
 *
 * @type {HomeSnapshot}
 */
const emptyHome: HomeSnapshot = {
  stats: { assigned: 0, late: 0, dueToday: 0, done: 0 },
  priorities: [],
  sprint: null,
  lists: [],
};

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

/**
 * Component FakeInboxDigest
 *
 * @description
 * Stands for Inbox's digest, whose reads Inbox's own specs cover.
 */
@Component({
  selector: 'cw-inbox-digest',
  template: '<p data-testid="fake-inbox-digest">Digest</p>',
})
class FakeInboxDigest {}

describe('HomePage', () => {
  let read: Mock<(today: string, options: HomeReadOptions) => Promise<HomeSnapshot>>;
  let people: Mock<() => Promise<readonly Person[]>>;
  let changed: Subject<string>;
  let rowActions: Record<string, unknown> & {
    open: Mock;
    setStatus: Mock;
    setPriority: Mock;
    sync: Mock;
    toggleAssignee: Mock;
    moveTo: Mock;
    askDelete: Mock;
    duplicate: Mock;
    setDeleteOpen: Mock;
    trash: Mock;
    confirmCancel: Mock;
    keepCancel: Mock;
    hidden: WritableSignal<readonly string[]>;
    pending: WritableSignal<Readonly<Record<string, Partial<TaskSummary>>>>;
    cancelKeys: WritableSignal<readonly string[] | null>;
    deleteOpen: WritableSignal<boolean>;
  };
  let taskCreate: { created: Subject<CreatedTask>; open: Mock };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30));
    read = vi.fn(() => Promise.resolve(camilleHome));
    people = vi.fn(() =>
      Promise.resolve([personOf('u-camille', 'Camille Martin'), personOf('u-ines', 'Inès Robert')]),
    );
    changed = new Subject<string>();
    const hidden: WritableSignal<readonly string[]> = signal<readonly string[]>([]);
    const pending: WritableSignal<Readonly<Record<string, Partial<TaskSummary>>>> = signal<
      Readonly<Record<string, Partial<TaskSummary>>>
    >({});
    const displayed: (task: TaskSummary) => TaskSummary = (task: TaskSummary): TaskSummary => ({
      ...task,
      ...pending()[task.key],
    });
    rowActions = {
      hidden,
      pending,
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
        tasks.filter((task: TaskSummary): boolean => !hidden().includes(task.key)).map(displayed),
      displayedTask: displayed,
      displayedStatus: (task: TaskSummary): StatusKey => task.status,
      open: vi.fn(),
      setStatus: vi.fn(),
      setPriority: vi.fn(),
      confirmCancel: vi.fn(),
      keepCancel: vi.fn(),
      setDeleteOpen: vi.fn(),
      trash: vi.fn(),
      toggleAssignee: vi.fn(),
      moveTo: vi.fn(),
      askDelete: vi.fn(),
      duplicate: vi.fn(),
    };
    taskCreate = { created: new Subject<CreatedTask>(), open: vi.fn() };
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
        { provide: HomeApi, useValue: { read, people } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal(organization),
            user: () => ({ firstName: 'Camille' }),
          },
        },
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
    url: string = '/atelier-nord',
  ): Promise<{ harness: RouterTestingHarness; element: HTMLElement }> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness);
    return { harness, element: harness.fixture.nativeElement as HTMLElement };
  }

  /**
   * Function lines
   *
   * @description
   * The text of each priority line, whitespace collapsed.
   *
   * @param {HTMLElement} element - The page.
   * @returns {readonly string[]} One entry per line.
   */
  function lines(element: HTMLElement): readonly string[] {
    return Array.from(element.querySelectorAll('cw-task-line')).map((line: Element) =>
      line.textContent.replace(/\s+/gu, ' ').trim(),
    );
  }

  /**
   * Function headings
   *
   * @description
   * The text of each `h2` of the page.
   *
   * @param {HTMLElement} element - The page.
   * @returns {readonly string[]} The headings, in order.
   */
  function headings(element: HTMLElement): readonly string[] {
    return Array.from(element.querySelectorAll('h2')).map((heading: Element) =>
      heading.textContent.trim(),
    );
  }

  /**
   * Function button
   *
   * @description
   * A button by its text.
   *
   * @param {HTMLElement} element - The page.
   * @param {string} name - Its text, from its start.
   * @returns {HTMLElement | undefined} The button.
   */
  function button(element: HTMLElement, name: string): HTMLElement | undefined {
    return Array.from(element.querySelectorAll<HTMLElement>('button')).find(
      (control: HTMLElement) => control.textContent.trim().startsWith(name),
    );
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
    Array.from(element.querySelectorAll('li[tabindex]'))
      .at(index)
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 8, clientY: 8 }));
    await settle(harness);
    return harness.fixture.debugElement.query(By.directive(TaskMenu)).componentInstance as TaskMenu;
  }

  it('keeps the greeting while the first read runs behind the skeleton', async () => {
    read.mockReturnValueOnce(new Promise<HomeSnapshot>(() => undefined));
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord');
    harness.detectChanges();
    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent.trim()).toBe('Hello Camille');
    const loading: HTMLElement | null = element.querySelector('[data-testid="home-loading"]');
    expect(loading?.getAttribute('aria-label')).toBe('Loading the home page');
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('cw-home-stats')).toBeNull();
    expect(element.querySelector('cw-inbox-digest')).toBeNull();
  });

  it('shows the counters, the priorities, the sprint, the mentions and the lists', async () => {
    const { element }: { element: HTMLElement } = await open();

    expect(read).toHaveBeenCalledWith('2026-11-12', expect.objectContaining({ passive: false }));
    expect(element.querySelector('[data-testid="home-stats"]')?.textContent).toContain(
      'Assigned to me',
    );
    expect(headings(element)).toEqual([
      'My priorities',
      'Sprint 14',
      'Mentions and activity',
      'Lists',
    ]);
    expect(lines(element)[0]).toContain('Fix the login redirect');
    expect(lines(element)[0]).toContain('CAD-470 · Sprint 14');
    expect(element.querySelector('[data-testid="fake-inbox-digest"]')).not.toBeNull();
    const links: readonly string[] = Array.from(element.querySelectorAll('a')).map(
      (link: Element) => link.getAttribute('href') ?? '',
    );
    expect(links).toEqual([
      '/atelier-nord/my-tasks',
      '/atelier-nord/l/l-sprint-14',
      '/atelier-nord/l/l-sprint-14',
      '/atelier-nord/l/l-research',
    ]);
    expect(rowActions.sync).toHaveBeenCalledTimes(1);
  });

  it('labels as archived only a list missing from a space whose lists the sidebar holds', async () => {
    const { element }: { element: HTMLElement } = await open();

    expect(lines(element)[2]).toContain('CAD-401 · Archived list');
    expect(lines(element)[3]).toContain('DES-12');
    expect(lines(element)[3]).not.toContain('·');
    const research: string =
      Array.from(element.querySelectorAll('[data-testid="home-list"]'))
        .at(1)
        ?.textContent.replace(/\s+/gu, ' ') ?? '';
    expect(research).toContain('Research');
    expect(research).not.toContain('Product');
  });

  it('opens a line in the task detail and creates a task from the header', async () => {
    const { element }: { element: HTMLElement } = await open();

    element.querySelector<HTMLButtonElement>('cw-task-line button')?.click();
    button(element, 'Create a task')?.click();

    expect(rowActions.open).toHaveBeenCalledWith(expect.objectContaining({ key: 'CAD-470' }));
    expect(taskCreate.open).toHaveBeenCalledTimes(1);
  });

  it('shows a successful empty home as empty, not as a failure, without sprint or lists', async () => {
    read.mockResolvedValueOnce(emptyHome);
    const { element }: { element: HTMLElement } = await open();

    expect(element.querySelector('[data-testid="home-priorities-empty"]')?.textContent).toContain(
      'Nothing is assigned to you.',
    );
    expect(element.querySelector('[data-testid="home-sprint"]')).toBeNull();
    expect(element.querySelector('cw-home-lists')).toBeNull();
    expect(headings(element)).toEqual(['My priorities', 'Mentions and activity']);
    expect(element.textContent).not.toContain('Could not load this page');
  });

  it('hands a failed first read to the error boundary, whose Retry reads again', async () => {
    read.mockRejectedValueOnce(new Error('unavailable'));
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();

    expect(element.querySelector('h1')?.textContent.trim()).toBe('Could not load this page');
    expect(element.querySelector('[data-testid="home-priorities-empty"]')).toBeNull();

    button(element, 'Retry')?.click();
    await settle(harness);

    expect(read).toHaveBeenCalledTimes(2);
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Hello Camille');
    expect(lines(element)).toHaveLength(4);
  });

  it('keeps the values of a failed refresh with an inline Retry', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();

    read.mockRejectedValueOnce(new Error('unavailable'));
    changed.next('CAD-470');
    await settle(harness);

    expect(read.mock.calls[1][1].passive).toBe(true);
    const stale: HTMLElement | null = element.querySelector('[data-testid="home-stale"]');
    expect(stale?.getAttribute('role')).toBe('alert');
    expect(stale?.textContent).toContain('The home page could not be refreshed.');
    expect(lines(element)).toHaveLength(4);

    button(element, 'Retry')?.click();
    await settle(harness);

    expect(read).toHaveBeenCalledTimes(3);
    expect(read.mock.calls[2][1].passive).toBe(false);
    expect(element.querySelector('[data-testid="home-stale"]')).toBeNull();
  });

  it('opens the task menu on a line and sends its writes through the row writes', async () => {
    const { harness }: { harness: RouterTestingHarness } = await open();

    const menu: TaskMenu = await menuOf(harness, 1);
    expect(menu.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-482']);
    expect(menu.lists().map((list) => list.name)).toEqual(['Sprint 14']);
    menu.statusPicked.emit('done');
    menu.priorityPicked.emit('urgente');
    menu.moved.emit('l-sprint-14');
    await settle(harness);
    menu.assigneeToggled.emit('u-ines');

    expect(rowActions.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CAD-482' }),
      'done',
    );
    expect(rowActions.setPriority).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CAD-482' }),
      'urgente',
    );
    expect(rowActions.moveTo).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CAD-482' }),
      expect.objectContaining({ listId: 'l-sprint-14' }),
    );
    expect(people).toHaveBeenCalledTimes(1);
    expect(rowActions.toggleAssignee).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CAD-482' }),
      expect.objectContaining({ id: 'u-ines' }),
    );
  });

  it("says in the menu's Assign that the members failed, and Retry reads them again", async () => {
    people.mockRejectedValueOnce(new Error('unavailable'));
    const { harness }: { harness: RouterTestingHarness } = await open();

    const menu: TaskMenu = await menuOf(harness, 0);
    await settle(harness);
    expect(menu.peopleState()).toBe('failed');
    expect(menu.people()).toEqual([]);

    menu.peopleRetried.emit();
    await settle(harness);

    expect(people).toHaveBeenCalledTimes(2);
    expect(menu.peopleState()).toBe('ready');
    expect(menu.people().map((person: Person) => person.name)).toEqual([
      'Camille Martin',
      'Inès Robert',
    ]);
  });

  it('runs the menu writes on the read copy and checks the drawn one', async () => {
    rowActions.pending.set({ 'CAD-482': { priority: 'urgente' } });
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();
    expect(lines(element)[1]).toContain('Urgent');

    const menu: TaskMenu = await menuOf(harness, 1);
    expect(menu.tasks().map((task: TaskSummary) => task.priority)).toEqual(['urgente']);
    menu.priorityPicked.emit('basse');
    menu.statusPicked.emit('done');
    menu.duplicateRequested.emit();
    menu.deleteRequested.emit();

    const readCopy: unknown = expect.objectContaining({ key: 'CAD-482', priority: 'haute' });
    expect(rowActions.setPriority).toHaveBeenCalledWith(readCopy, 'basse');
    expect(rowActions.setStatus).toHaveBeenCalledWith(readCopy, 'done');
    expect(rowActions.duplicate).toHaveBeenCalledWith(readCopy);
    expect(rowActions.askDelete).toHaveBeenCalledWith(readCopy);
  });

  it('confirms a deletion of the menu and hides the deleted line at once', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();

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

    rowActions.hidden.set(['CAD-470']);
    await settle(harness);
    expect(lines(element)[0]).toContain('Review of the SSO flow');
  });

  it('binds the cancel reason dialog to the row writes', async () => {
    const { harness }: { harness: RouterTestingHarness } = await open();

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

  it('says the logo of the new organization could not be uploaded until dismissed', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord?notice=logo-upload-failed');

    expect(element.querySelector('cw-alert')?.textContent).toContain(
      'The organization was created, but its logo could not be uploaded.',
    );
    element.querySelector<HTMLButtonElement>('cw-alert button')?.click();
    await settle(harness);
    expect(element.querySelector('cw-alert')).toBeNull();
  });
});
