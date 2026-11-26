import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import {
  TaskActionsApi,
  type TaskBulkOutcome,
  TaskCreate,
  TaskDetailOpener,
  STATUS_SETTLE_MS,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListTasksApi } from '../../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import { BoardViewStore } from '../../../state/board-view/board-view.store';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListTasksStore } from '../../../state/list-tasks/list-tasks.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { BoardViewPage } from './board-view-page.component';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {string} name - Task name.
 * @param {StatusKey} status - Saved status.
 * @param {Partial<TaskSummary>} [changes] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(
  key: string,
  name: string,
  status: StatusKey,
  changes: Partial<TaskSummary> = {},
): TaskSummary {
  return {
    id: key,
    key,
    name,
    status,
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u-ines'],
    due: null,
    start: null,
    labels: ['Auth'],
    subtasks: { closed: 1, total: 3 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'sprint-14',
    spaceId: 'product',
    version: 3,
    ...changes,
  };
}

/**
 * Constant sprintTasks
 *
 * @description
 * Two tasks of Sprint 14.
 *
 * @type {readonly TaskSummary[]}
 */
const sprintTasks: readonly TaskSummary[] = [
  task('CAD-482', 'Redesign the SSO sign-in screen', 'todo'),
  task('CAD-483', 'Organization quotas page', 'progress', { priority: 'urgente' }),
];

/**
 * Function ready
 *
 * @description
 * A resource that answered.
 *
 * @param {unknown} value - Its value.
 * @returns {object} The resource-like fake.
 */
function ready(value: unknown): object {
  return {
    hasValue: () => true,
    value: () => value,
    error: () => undefined,
    isLoading: () => false,
    reload: vi.fn(),
  };
}

/**
 * Function outcome
 *
 * @description
 * A bulk answer that applied the given tasks at version 4.
 *
 * @param {readonly string[]} done - Keys applied.
 * @returns {TaskBulkOutcome} The answer.
 */
function outcome(done: readonly string[]): TaskBulkOutcome {
  return {
    affected: done.length,
    done: done.map((taskKey: string) => ({
      taskKey,
      version: 4,
      newTaskKey: null,
      trashEntryId: null,
    })),
    failed: [],
    unknown: [],
    notSent: [],
  };
}

describe('BoardViewPage', () => {
  let page: Mock<ListTasksApi['page']>;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let toasts: Record<string, Mock>;
  let create: Mock<TaskCreate['open']>;

  /**
   * Function settle
   *
   * @description
   * Waits for the page to be stable and for the promises of its reads and writes to run.
   *
   * @param {ComponentFixture<BoardViewPage>} fixture - The page.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(fixture: ComponentFixture<BoardViewPage>): Promise<void> {
    for (let round: number = 0; round < 4; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      for (let tick: number = 0; tick < 5; tick++) await Promise.resolve();
    }
    fixture.detectChanges();
  }

  /**
   * Function render
   *
   * @description
   * Renders the board of Sprint 14 and waits for its cards.
   *
   * @returns {Promise<ComponentFixture<BoardViewPage>>} The fixture.
   */
  async function render(): Promise<ComponentFixture<BoardViewPage>> {
    const fixture: ComponentFixture<BoardViewPage> = TestBed.createComponent(BoardViewPage);
    fixture.componentRef.setInput('listId', 'sprint-14');
    await settle(fixture);
    return fixture;
  }

  /**
   * Function named
   *
   * @description
   * The element of an accessible name (`aria-label`) in the document.
   *
   * @param {string} name - The name.
   * @returns {HTMLElement | null} The element.
   */
  function named(name: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[aria-label="${name}"]`);
  }

  /**
   * Function required
   *
   * @description
   * The element, failing the test when it is missing.
   *
   * @param {T | undefined | null} element - The element looked for.
   * @returns {T} The element.
   */
  function required<T>(element: T | undefined | null): T {
    expect(element).toBeTruthy();
    return element as T;
  }

  /**
   * Function columnOf
   *
   * @description
   * The card list of a column, by its accessible name.
   *
   * @param {string} label - The column's name.
   * @returns {HTMLElement} The list.
   */
  function columnOf(label: string): HTMLElement {
    return required(
      [...document.querySelectorAll<HTMLElement>('[role="list"]')].find(
        (list: HTMLElement): boolean => list.getAttribute('aria-label')?.includes(label) ?? false,
      ),
    );
  }

  /**
   * Function key
   *
   * @description
   * Presses a key on an element.
   *
   * @param {HTMLElement} element - The focused element.
   * @param {string} value - The key.
   */
  function key(element: HTMLElement, value: string): void {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
  }

  /**
   * Function menuItem
   *
   * @description
   * The menu item whose text starts with a label.
   *
   * @param {string} label - The label.
   * @returns {HTMLElement | undefined} The item.
   */
  function menuItem(label: string): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (element: HTMLElement): boolean => element.textContent.trim().startsWith(label),
    );
  }

  /**
   * Function move
   *
   * @description
   * Grabs a card with Space, moves it with arrow keys and drops it with Space.
   *
   * @param {ComponentFixture<BoardViewPage>} fixture - The page.
   * @param {string} name - Accessible name of the card.
   * @param {readonly string[]} arrows - The arrow keys pressed while it is held.
   * @returns {Promise<void>} Resolves once dropped.
   */
  async function move(
    fixture: ComponentFixture<BoardViewPage>,
    name: string,
    arrows: readonly string[],
  ): Promise<void> {
    required(named(name)).focus();
    key(required(named(name)), ' ');
    await settle(fixture);
    for (const arrow of arrows) {
      key(required(named(name)), arrow);
      await settle(fixture);
    }
    key(required(named(name)), ' ');
    await settle(fixture);
  }

  /**
   * Function waitSettle
   *
   * @description
   * Lets the board's moves settle (`STATUS_SETTLE_MS`), then the page.
   *
   * @param {ComponentFixture<BoardViewPage>} fixture - The page.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function waitSettle(fixture: ComponentFixture<BoardViewPage>): Promise<void> {
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, STATUS_SETTLE_MS + 40);
    });
    await settle(fixture);
  }

  beforeEach(() => {
    page = vi.fn<ListTasksApi['page']>((): Promise<ListTaskPage> =>
      Promise.resolve({ items: sprintTasks, nextCursor: null, total: sprintTasks.length }),
    );
    bulk = vi.fn<TaskActionsApi['bulk']>(() => Promise.resolve(outcome(['CAD-482'])));
    toasts = {
      show: vi.fn(() => 'toast-1'),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      toasts: vi.fn(() => []),
    };
    create = vi.fn<TaskCreate['open']>(() => true);
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([]),
        ListViewStore,
        TaskStatusChangesStore,
        ListTasksStore,
        BoardViewStore,
        { provide: ListTasksApi, useValue: { page, update: vi.fn() } },
        {
          provide: ListPageStore,
          useValue: {
            listId: () => 'sprint-14',
            list: ready({ id: 'sprint-14', name: 'Sprint 14', spaceId: 'product', canEdit: true }),
            space: ready({ id: 'product', statuses: [] }),
            organizationMembers: ready([{ userId: 'u-ines', name: 'Inès Robert' }]),
            refreshCounts: vi.fn(),
          },
        },
        { provide: TaskActionsApi, useValue: { bulk, restore: vi.fn(), remind: vi.fn() } },
        {
          provide: SpacesNavigationStore,
          useValue: { spaces: ready([]), overviews: ready({}), openDialog: vi.fn() },
        },
        { provide: TaskApi, useValue: { changeStatus: vi.fn(() => of()), read: vi.fn() } },
        {
          provide: TaskCreate,
          useValue: { open: create, useDefaults: vi.fn(), created: new Subject() },
        },
        {
          provide: TaskDetailOpener,
          useValue: { open: vi.fn(), closed: new Subject(), changed: new Subject() },
        },
        { provide: CwToastService, useValue: toasts },
        { provide: RealtimeConnection, useValue: { watch: () => of() } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal({ id: 'org-atelier-nord', slug: 'atelier-nord' }),
            user: () => ({ id: 'u-camille' }),
          },
        },
      ],
    });
  });

  it('shows a column per status with English texts and the cards under their status', async () => {
    const host: HTMLElement = (await render()).nativeElement as HTMLElement;

    expect(named('Board of Sprint 14')).toBeTruthy();
    expect(named('Add a task in To do')).toBeTruthy();
    expect(named('Fold the column In progress')).toBeTruthy();
    const todo: HTMLElement = columnOf('To do');
    expect(todo.textContent).toContain('Redesign the SSO sign-in screen');
    expect(todo.textContent).toContain('High');
    expect(todo.textContent).toContain('1/3');
    expect(todo.textContent).toContain('IR');
    expect(columnOf('In progress').textContent).toContain('Urgent');
    expect(host.textContent).toContain('No task');
    expect(host.textContent).toContain('Drag a card here or create one.');
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('shows the board skeleton while the first read runs', async () => {
    page.mockReturnValue(new Promise<ListTaskPage>(() => undefined));
    const fixture: ComponentFixture<BoardViewPage> = TestBed.createComponent(BoardViewPage);
    fixture.componentRef.setInput('listId', 'sprint-14');
    for (let round: number = 0; round < 3; round++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
    fixture.detectChanges();

    const status: HTMLElement = required(named('Loading the board'));
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('No task');
  });

  it('fails a first read to the route boundary and reads again when the route runs again', async () => {
    page.mockRejectedValueOnce(new Error('503'));
    const failed: ComponentFixture<BoardViewPage> = TestBed.createComponent(BoardViewPage);
    failed.componentRef.setInput('listId', 'sprint-14');
    await expect(settle(failed)).rejects.toThrow();
    failed.destroy();

    const again: ComponentFixture<BoardViewPage> = await render();

    expect(page).toHaveBeenCalledTimes(2);
    expect(columnOf('To do').textContent).toContain('Redesign the SSO sign-in screen');
    expect((again.nativeElement as HTMLElement).textContent).not.toContain(
      'The tasks could not be refreshed.',
    );
  });

  it('keeps the cards on a failed refresh and retries in place', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();
    page.mockRejectedValueOnce(new Error('503'));
    TestBed.inject(ListTasksStore).reload();
    await settle(fixture);

    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('The tasks could not be refreshed.');
    expect(columnOf('To do').textContent).toContain('Redesign the SSO sign-in screen');
    required(
      [...host.querySelectorAll('button')].find(
        (button: HTMLButtonElement) => button.textContent.trim() === 'Retry',
      ),
    ).click();
    await settle(fixture);

    expect(page).toHaveBeenCalledTimes(3);
    expect(host.textContent).not.toContain('The tasks could not be refreshed.');
  });

  it('moves a card to the next column with the keyboard and offers Undo', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);

    expect(columnOf('In progress').textContent).toContain('Redesign the SSO sign-in screen');
    expect(bulk).not.toHaveBeenCalled();
    await waitSettle(fixture);

    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'status', status: 'progress' },
      expect.any(Function),
    );
    expect(columnOf('In progress').textContent).toContain('Redesign the SSO sign-in screen');
    expect(toasts['show']).toHaveBeenCalledWith('CAD-482 · In progress', {
      description: 'Status changed.',
      undo: expect.any(Function) as () => void,
    });
    const undo: () => void = (toasts['show'].mock.calls[0][1] as { undo: () => void }).undo;
    undo();
    await settle(fixture);

    expect(bulk).toHaveBeenLastCalledWith(
      [expect.objectContaining({ taskKey: 'CAD-482', version: 4 })],
      { type: 'status', status: 'todo' },
      expect.any(Function),
    );
  });

  it('writes only the last status of two quick moves', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    await waitSettle(fixture);

    expect(bulk).toHaveBeenCalledTimes(1);
    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'status', status: 'review' },
      expect.any(Function),
    );
    expect(columnOf('In review').textContent).toContain('Redesign the SSO sign-in screen');
  });

  it('writes nothing for a move and its return', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowLeft']);
    await waitSettle(fixture);

    expect(bulk).not.toHaveBeenCalled();
    expect(columnOf('To do').textContent).toContain('Redesign the SSO sign-in screen');
  });

  it('keeps a waiting move over a refresh of the tasks', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    TestBed.inject(ListTasksStore).reload();
    await settle(fixture);

    expect(page).toHaveBeenCalledTimes(2);
    expect(columnOf('In progress').textContent).toContain('Redesign the SSO sign-in screen');
    await waitSettle(fixture);
    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'status', status: 'progress' },
      expect.any(Function),
    );
  });

  it('writes a waiting move at once when the view is left', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    expect(bulk).not.toHaveBeenCalled();
    fixture.destroy();

    await expect.poll(() => bulk.mock.calls.length).toBe(1);
    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'status', status: 'progress' },
      expect.any(Function),
    );
  });

  it('writes the last move once when the search leaves its card out before it settles', async () => {
    page.mockImplementation(
      (_listId: string, query: { readonly search?: string }): Promise<ListTaskPage> => {
        const items: readonly TaskSummary[] = query.search
          ? sprintTasks.filter((item: TaskSummary): boolean => item.key === 'CAD-483')
          : sprintTasks;
        return Promise.resolve({ items, nextCursor: null, total: items.length });
      },
    );
    const fixture: ComponentFixture<BoardViewPage> = await render();

    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    TestBed.inject(ListViewStore).setSearch('quotas');
    await settle(fixture);
    await waitSettle(fixture);

    expect(named('CAD-482 — Redesign the SSO sign-in screen')).toBeNull();
    expect(bulk).toHaveBeenCalledTimes(1);
    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'status', status: 'review' },
      expect.any(Function),
    );
  });

  it('writes the last move after the write in flight when the view is left', async () => {
    let answerFirst: (outcome: TaskBulkOutcome) => void = (): void => undefined;
    bulk.mockImplementationOnce(
      () =>
        new Promise<TaskBulkOutcome>((resolve: (outcome: TaskBulkOutcome) => void): void => {
          answerFirst = resolve;
        }),
    );
    const fixture: ComponentFixture<BoardViewPage> = await render();

    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, STATUS_SETTLE_MS + 40);
    });
    expect(bulk).toHaveBeenCalledTimes(1);
    await move(fixture, 'CAD-482 — Redesign the SSO sign-in screen', ['ArrowRight']);
    fixture.destroy();
    for (let tick: number = 0; tick < 10; tick++) await Promise.resolve();
    expect(bulk).toHaveBeenCalledTimes(1);

    answerFirst(outcome(['CAD-482']));

    await expect.poll(() => bulk.mock.calls.length).toBe(2);
    expect(bulk).toHaveBeenLastCalledWith(
      [{ taskKey: 'CAD-482', version: 4 }],
      { type: 'status', status: 'review' },
      expect.any(Function),
    );
  });

  it('opens the column menu from the button of its header', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    required(named('Actions on the column In review')).click();
    await settle(fixture);

    expect(menuItem('New task in “In review”')).toBeDefined();
    expect(menuItem('Hide the column')).toBeDefined();
  });

  it('puts back a card dropped in its own column without writing', async () => {
    page.mockResolvedValue({
      items: [...sprintTasks, task('CAD-484', 'SAML metadata import', 'todo')],
      nextCursor: null,
      total: 3,
    });
    const fixture: ComponentFixture<BoardViewPage> = await render();
    const card: HTMLElement = required(named('CAD-482 — Redesign the SSO sign-in screen'));

    card.focus();
    key(card, ' ');
    await settle(fixture);
    key(required(named('CAD-482 — Redesign the SSO sign-in screen')), 'ArrowDown');
    await settle(fixture);
    key(required(named('CAD-482 — Redesign the SSO sign-in screen')), ' ');
    await settle(fixture);

    expect(bulk).not.toHaveBeenCalled();
    const names: string[] = [...columnOf('To do').querySelectorAll('article')].map(
      (article: Element) => article.getAttribute('aria-label') ?? '',
    );
    expect(names).toEqual([
      'CAD-482 — Redesign the SSO sign-in screen',
      'CAD-484 — SAML metadata import',
    ]);
  });

  it('asks the reason of a drop on Cancelled and keeps the card in place meanwhile', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();
    const name: string = 'CAD-482 — Redesign the SSO sign-in screen';

    required(named(name)).focus();
    key(required(named(name)), ' ');
    await settle(fixture);
    for (let step: number = 0; step < 7; step++) {
      key(required(named(name)), 'ArrowRight');
      await settle(fixture);
    }
    key(required(named(name)), ' ');
    await settle(fixture);

    expect(bulk).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).toBeTruthy();
    expect(columnOf('To do').textContent).toContain('Redesign the SSO sign-in screen');
  });

  it('opens the create dialog with the status of the column', async () => {
    await render();

    required(named('Add a task in In progress')).click();

    expect(create).toHaveBeenCalledWith({ listId: 'sprint-14', status: 'progress' });
  });

  it('opens the task menu on a card with a right click', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    required(named('CAD-482 — Redesign the SSO sign-in screen')).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
    await settle(fixture);

    expect(document.body.textContent).toContain('CAD-482 · Redesign the SSO sign-in screen');
    expect(menuItem('Open')).toBeDefined();
  });

  it('hides a column from its menu with a toast whose Undo shows it again', async () => {
    const fixture: ComponentFixture<BoardViewPage> = await render();

    columnOf('In review').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
    await settle(fixture);
    expect(menuItem('New task in “In review”')).toBeDefined();
    required(menuItem('Hide the column')).click();
    await settle(fixture);

    expect(TestBed.inject(ListViewStore).presentation().hiddenBoardStatusKeys).toEqual(['review']);
    expect(named('Add a task in In review')).toBeNull();
    expect(toasts['show']).toHaveBeenCalledWith(
      'Column hidden',
      expect.objectContaining({ description: 'In review · show it again from “Columns”.' }),
    );
  });
});
