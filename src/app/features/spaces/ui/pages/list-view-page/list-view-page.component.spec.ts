import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { CwDataTable } from '@cadenway/ui/components/data-table';
import type { StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import {
  TaskActionsApi,
  type TaskBulkOutcome,
  TaskCreate,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { LIST_TABLE_TEXTS } from '../../../constants/data-table-texts/data-table-texts.constants';
import { ListTasksApi } from '../../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListRowsStore } from '../../../state/list-rows/list-rows.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { ListViewPage } from './list-view-page.component';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the « Produit » space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {string} name - Task name.
 * @param {StatusKey} status - Saved status.
 * @returns {TaskSummary} The task.
 */
function task(key: string, name: string, status: StatusKey): TaskSummary {
  return {
    id: key,
    key,
    name,
    status,
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due: null,
    start: null,
    labels: ['Auth'],
    subtasks: { closed: 0, total: 0 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'sprint-14',
    spaceId: 'produit',
    version: 3,
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
  task('CAD-482', 'Refondre l’écran de connexion SSO', 'todo'),
  task('CAD-483', 'Page des quotas d’organisation', 'progress'),
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

describe('ListViewPage', () => {
  let page: Mock<ListTasksApi['page']>;
  let groups: Mock<ListTasksApi['groups']>;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let restore: Mock<TaskActionsApi['restore']>;
  let refreshCounts: Mock<() => void>;
  let toasts: Record<string, Mock>;
  let openDialog: Mock<(dialog: unknown) => void>;

  /**
   * Function outcome
   *
   * @description
   * A bulk answer that applied the given tasks at version 4.
   *
   * @param {readonly string[]} done - Keys applied.
   * @param {Partial<TaskBulkOutcome>} [rest] - Other members.
   * @returns {TaskBulkOutcome} The answer.
   */
  function outcome(done: readonly string[], rest: Partial<TaskBulkOutcome> = {}): TaskBulkOutcome {
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
      ...rest,
    };
  }

  /**
   * Function menuItem
   *
   * @description
   * The menu item whose text starts with a label (status items carry their hint after it).
   *
   * @param {string} label - The label.
   * @returns {HTMLElement | undefined} The item.
   */
  function menuItem(label: string): HTMLElement | undefined {
    return [
      ...document.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
      ),
    ].find((element: HTMLElement): boolean => element.textContent.trim().startsWith(label));
  }

  /**
   * Function openRowMenu
   *
   * @description
   * Opens the menu of a row with a right click on its « … » button.
   *
   * @param {ComponentFixture<ListViewPage>} fixture - The page.
   * @param {string} key - Key of the row.
   * @returns {Promise<void>} Resolves once the menu shows.
   */
  async function openRowMenu(fixture: ComponentFixture<ListViewPage>, key: string): Promise<void> {
    required(button(`Actions sur ${key}`)).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();
  }

  /**
   * Function openSubmenu
   *
   * @description
   * Opens a submenu of the open row menu.
   *
   * @param {ComponentFixture<ListViewPage>} fixture - The page.
   * @param {string} label - The item that opens it.
   * @returns {Promise<void>} Resolves once the submenu shows.
   */
  async function openSubmenu(
    fixture: ComponentFixture<ListViewPage>,
    label: string,
  ): Promise<void> {
    required(menuItem(label)).click();
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();
  }

  /**
   * Function render
   *
   * @description
   * Renders the view of Sprint 14 grouped by status and waits for its rows.
   *
   * @returns {Promise<ComponentFixture<ListViewPage>>} The fixture.
   */
  async function render(): Promise<ComponentFixture<ListViewPage>> {
    const fixture: ComponentFixture<ListViewPage> = TestBed.createComponent(ListViewPage);
    fixture.componentRef.setInput('listId', 'sprint-14');
    for (let round: number = 0; round < 5; round++) {
      await settle(fixture);
      fixture.detectChanges();
    }
    return fixture;
  }

  /**
   * Function settle
   *
   * @description
   * Waits for the page to be stable and for the promises of its writes to run.
   *
   * @param {ComponentFixture<ListViewPage>} fixture - The page.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(fixture: ComponentFixture<ListViewPage>): Promise<void> {
    for (let round: number = 0; round < 4; round++) {
      await fixture.whenStable();
      for (let tick: number = 0; tick < 5; tick++) await Promise.resolve();
    }
  }

  /**
   * Function button
   *
   * @description
   * The button of an accessible name in the document (menus render outside the page).
   *
   * @param {string} name - Its accessible name, `aria-label` or text.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(name: string): HTMLButtonElement | undefined {
    return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (element: HTMLButtonElement): boolean =>
        (element.getAttribute('aria-label') ?? element.textContent.trim()) === name,
    );
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
   * Function checkbox
   *
   * @description
   * The checkbox of an accessible name.
   *
   * @param {string} name - Its accessible name.
   * @returns {HTMLElement | undefined} The checkbox.
   */
  function checkbox(name: string): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>('[role="checkbox"], input')].find(
      (element: HTMLElement): boolean => element.getAttribute('aria-label') === name,
    );
  }

  beforeEach(() => {
    groups = vi.fn(() =>
      Promise.resolve([
        { value: 'todo', count: 1 },
        { value: 'progress', count: 1 },
        { value: 'cancelled', count: 0 },
      ]),
    );
    page = vi.fn<ListTasksApi['page']>((_listId, _query, group): Promise<ListTaskPage> =>
      Promise.resolve({
        items: sprintTasks.filter((item: TaskSummary) => item.status === group?.value),
        nextCursor: null,
        total: 1,
      }),
    );
    bulk = vi.fn<TaskActionsApi['bulk']>(() => Promise.resolve(outcome(['CAD-482'])));
    restore = vi.fn<TaskActionsApi['restore']>(() => Promise.resolve());
    refreshCounts = vi.fn();
    toasts = { show: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn() };
    openDialog = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([]),
        ListViewStore,
        TaskStatusChangesStore,
        ListRowsStore,
        LIST_TABLE_TEXTS,
        {
          provide: ListTasksApi,
          useValue: {
            groups,
            page,
            subtasks: vi.fn(() => Promise.resolve([])),
          },
        },
        {
          provide: ListPageStore,
          useValue: {
            listId: () => 'sprint-14',
            list: ready({
              id: 'sprint-14',
              name: 'Sprint 14',
              spaceId: 'produit',
              sprint: { startDate: '2026-11-16', endDate: '2026-11-29' },
              canEdit: true,
            }),
            space: ready({ id: 'produit', statuses: [] }),
            organizationMembers: ready([{ userId: 'u-ines', name: 'Inès Robert' }]),
            refreshCounts,
            exportCsv: vi.fn(() => Promise.resolve(null)),
          },
        },
        { provide: TaskActionsApi, useValue: { bulk, restore, remind: vi.fn() } },
        {
          provide: SpacesNavigationStore,
          useValue: { spaces: ready([]), overviews: ready({}), openDialog },
        },
        { provide: TaskApi, useValue: { changeStatus: vi.fn(() => of()), read: vi.fn() } },
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

  it('names the table after the list and shows the rows under their status group', async () => {
    const host: HTMLElement = (await render()).nativeElement as HTMLElement;

    expect(host.querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe(
      'Tâches de la liste Sprint 14',
    );
    const headers: string[] = [...host.querySelectorAll('[role="columnheader"]')].map(
      (header: Element) => header.textContent.trim(),
    );
    expect(headers).toEqual(
      expect.arrayContaining(['Nom', 'Assignés', 'Échéance', 'Priorité', 'Étiquettes']),
    );
    const text: string = host.textContent;
    expect(text).toContain('À faire');
    expect(text).toContain('En cours');
    expect(text).toContain('Refondre l’écran de connexion SSO');
    expect(text).toContain('CAD-482');
    expect(checkbox('Sélectionner CAD-482')).toBeDefined();
  });

  it('passes server counts, phone columns and row motion to the table', async () => {
    groups.mockResolvedValue([
      { value: 'todo', count: 25 },
      { value: 'progress', count: 0 },
    ]);
    const fixture: ComponentFixture<ListViewPage> = await render();
    const table: CwDataTable<unknown> = fixture.debugElement.query(By.directive(CwDataTable))
      .componentInstance as CwDataTable<unknown>;
    expect(table.groups()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'todo', count: 25 }),
        expect.objectContaining({ value: 'progress', count: 0 }),
      ]),
    );
    expect(table.phoneLayout()).toBe('grid');
    expect(table.phoneColumns()).toEqual(['due']);
    expect(table.rowMotion()?.({ entering: true })).toBe('in');
    expect(table.rowMotion()?.({ entering: false })).toBeNull();
  });

  it('uses the mockup due-date width on phones', async () => {
    TestBed.overrideProvider(BreakpointObserver, {
      useValue: { observe: () => of({ matches: true, breakpoints: {} }) },
    });
    const fixture: ComponentFixture<ListViewPage> = await render();
    const columns: NodeListOf<HTMLTableColElement> = (
      fixture.nativeElement as HTMLElement
    ).querySelectorAll('col');
    expect(columns[3].style.width).toBe('88px');
  });

  it('shows the empty state instead of groups when a search has no matches', async () => {
    groups.mockResolvedValue([]);
    const view: InstanceType<typeof ListViewStore> = TestBed.inject(ListViewStore);
    view.setSearch('missing');
    const fixture: ComponentFixture<ListViewPage> = await render();
    const table: CwDataTable<unknown> = fixture.debugElement.query(By.directive(CwDataTable))
      .componentInstance as CwDataTable<unknown>;
    expect(table.filtered()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Aucune tâche ne correspond',
    );
  });

  it('keeps workflow order and shows only the five default empty status groups', async () => {
    groups.mockResolvedValue(
      [
        'triage',
        'progress',
        'review',
        'testing',
        'todo',
        'blocked',
        'waiting',
        'backlog',
        'done',
        'cancelled',
      ].map((value) => ({ value, count: 0 })),
    );
    const fixture: ComponentFixture<ListViewPage> = await render();
    const table: CwDataTable<unknown> = fixture.debugElement.query(By.directive(CwDataTable))
      .componentInstance as CwDataTable<unknown>;
    expect(table.groups().map((group) => group.value)).toEqual([
      'progress',
      'review',
      'todo',
      'blocked',
      'done',
    ]);
  });

  it('hides empty groups when a search has results', async () => {
    groups.mockResolvedValue([
      { value: 'progress', count: 0 },
      { value: 'todo', count: 1 },
      { value: 'done', count: 0 },
    ]);
    TestBed.inject(ListViewStore).setSearch('SSO');
    const fixture: ComponentFixture<ListViewPage> = await render();
    const table: CwDataTable<unknown> = fixture.debugElement.query(By.directive(CwDataTable))
      .componentInstance as CwDataTable<unknown>;
    expect(table.groups().map((group) => group.value)).toEqual(['todo']);
  });

  it('shows only the selected status and its add row', async () => {
    groups.mockResolvedValue([{ value: 'todo', count: 1 }]);
    TestBed.inject(ListViewStore).toggleFilter('status', 'todo');
    const fixture: ComponentFixture<ListViewPage> = await render();
    const table: CwDataTable<unknown> = fixture.debugElement.query(By.directive(CwDataTable))
      .componentInstance as CwDataTable<unknown>;
    expect(table.groups().map((group) => group.value)).toEqual(['todo']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button').length,
    ).toBeGreaterThan(0);
    expect(
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].filter(
        (element) => element.textContent.trim() === 'Ajouter une tâche',
      ),
    ).toHaveLength(1);
  });

  it('shows the unfiltered empty state when no declared group is visible', async () => {
    groups.mockResolvedValue([{ value: 'triage', count: 0 }]);
    const fixture: ComponentFixture<ListViewPage> = await render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucune tâche');
  });

  it('renders visible tasks after a full hidden status group', async () => {
    groups.mockResolvedValue([
      { value: 'triage', count: 50 },
      { value: 'todo', count: 1 },
    ]);
    vi.spyOn(TestBed.inject(ListPageStore).space, 'value').mockReturnValue({
      id: 'produit',
      name: 'Produit',
      description: null,
      icon: null,
      color: 'gris',
      private: false,
      statuses: [{ key: 'triage', name: null, hidden: true }],
    });
    page.mockImplementation((_list, _query, group) =>
      Promise.resolve({
        items:
          group?.value === 'triage'
            ? Array.from({ length: 50 }, (_, index: number) =>
                task(`CAD-${String(index)}`, 'Hidden', 'triage'),
              )
            : [sprintTasks[0]],
        nextCursor: null,
        total: group?.value === 'triage' ? 50 : 1,
      }),
    );

    const fixture: ComponentFixture<ListViewPage> = await render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Refondre l’écran de connexion SSO',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Aucune tâche');
    expect(page.mock.calls.map((call) => call[2]?.value)).toEqual(['todo']);
  });

  it('opens the task from its status icon and creates a subtask with its parent', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const navigate: MockInstance = vi.spyOn(TestBed.inject(Router), 'navigate');
    const create: MockInstance = vi.spyOn(TestBed.inject(TaskCreate), 'open');
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const taskButton: HTMLButtonElement = required(
      [...host.querySelectorAll<HTMLButtonElement>('button')].find((element: HTMLButtonElement) =>
        element.textContent.includes('Refondre l’écran de connexion SSO'),
      ),
    );
    required(taskButton.querySelector<HTMLElement>('cw-status-icon')).click();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { task: 'CAD-482' } }),
    );
    required(button('Ajouter une sous-tâche à CAD-482')).click();
    expect(create).toHaveBeenCalledWith({ parentKey: 'CAD-482', listId: 'sprint-14' });
  });

  it('keeps focus on the task after its status group changes', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const taskButton: HTMLButtonElement = required(
      [...host.querySelectorAll<HTMLButtonElement>('cw-task-title-cell button')].find(
        (element: HTMLButtonElement) => element.textContent.includes('Refondre l’écran'),
      ),
    );
    taskButton.focus();
    TestBed.inject(TaskStatusChangesStore).request(sprintTasks[0], 'progress');
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();
    expect(
      TestBed.inject(ListRowsStore)
        .rows()
        .find((row) => row.task.key === 'CAD-482')?.group,
    ).toBe('progress');
    expect(document.activeElement?.textContent).toContain('Refondre l’écran');
  });

  it('opens a task in the address from its name', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const navigate: MockInstance = vi.spyOn(TestBed.inject(Router), 'navigate');

    const name: HTMLButtonElement | undefined = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ].find((element: HTMLButtonElement) =>
      element.textContent.includes('Refondre l’écran de connexion SSO'),
    );
    required(name).click();

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { task: 'CAD-482' },
        queryParamsHandling: 'merge',
      }),
    );
  });

  it('opens the menu for the row receiving Shift+F10', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const name: HTMLButtonElement = required(
      [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
      ].find((element: HTMLButtonElement) => element.textContent.includes('Page des quotas')),
    );
    name.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();

    expect(document.body.textContent).toContain('CAD-483 · Page des quotas d’organisation');
  });

  it('does not emit a destroyed output when a row menu is open during teardown', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const warn: MockInstance = vi.spyOn(console, 'warn');
    const name: HTMLButtonElement = required(
      [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
      ].find((element: HTMLButtonElement) => element.textContent.includes('Page des quotas')),
    );
    name.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await settle(fixture);
    fixture.destroy();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('NG0953'));
    warn.mockRestore();
  });

  it('opens the menu for the row receiving a touch long press', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const name: HTMLButtonElement = required(
      [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
      ].find((element: HTMLButtonElement) => element.textContent.includes('Page des quotas')),
    );
    const press: Event = new Event('pointerdown', { bubbles: true });
    Object.defineProperties(press, {
      pointerType: { value: 'touch' },
      clientX: { value: 20 },
      clientY: { value: 20 },
    });
    name.dispatchEvent(press);
    await new Promise<void>((resolve) => setTimeout(resolve, 520));
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();
    expect(document.body.textContent).toContain('CAD-483 · Page des quotas d’organisation');
  });

  it('retains rows and selection on a failed refresh and retries in place', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    page.mockRejectedValueOnce(new Error('503'));
    TestBed.inject(ListRowsStore).reload();
    await settle(fixture);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 sélectionnée');
    expect(button('Réessayer')).toBeDefined();
    required(button('Réessayer')).click();
    await settle(fixture);
    fixture.detectChanges();
    expect(button('Réessayer')).toBeUndefined();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('CAD-482');
  });

  it('runs a bulk action on the selection and keeps a refused chunk selected', async () => {
    bulk.mockResolvedValueOnce(
      outcome(['CAD-482'], { failed: [{ taskKey: 'CAD-483', version: 3 }] }),
    );
    const fixture: ComponentFixture<ListViewPage> = await render();

    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 sélectionnées');

    required(button('Marquer terminé')).click();
    await settle(fixture);
    fixture.detectChanges();

    expect(bulk).toHaveBeenCalledWith(
      [
        { taskKey: 'CAD-482', version: 3 },
        { taskKey: 'CAD-483', version: 3 },
      ],
      { type: 'status', status: 'done' },
      expect.any(Function),
    );
    expect(toasts['show']).toHaveBeenCalledWith('1 tâche terminée', expect.anything());
    expect(refreshCounts).toHaveBeenCalled();
    expect(toasts['error']).toHaveBeenCalledWith(
      '1 tâche sur 2 n’a pas pu être modifiée',
      expect.anything(),
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 sélectionnée');
  });

  it('shows the plural toast when two selected tasks are marked done', async () => {
    bulk.mockResolvedValueOnce(outcome(['CAD-482', 'CAD-483']));
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();

    required(button('Marquer terminé')).click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('2 sélectionnées');
    await settle(fixture);

    expect(toasts['show']).toHaveBeenCalledWith('2 tâches terminées', {
      description: 'Statut : Terminé.',
      undo: expect.any(Function) as unknown,
    });
  });

  it("puts the statuses back with the reverse write of the toast's Annuler", async () => {
    bulk.mockResolvedValueOnce(outcome(['CAD-482', 'CAD-483']));
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();
    required(button('Marquer terminé')).click();
    await settle(fixture);
    const options: { undo: () => void } = toasts['show'].mock.calls[0][1] as { undo: () => void };

    options.undo();
    await settle(fixture);

    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 4 }],
      { type: 'status', status: 'todo' },
      expect.any(Function),
    );
    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-483', version: 4 }],
      { type: 'status', status: 'progress' },
      expect.any(Function),
    );
  });

  it('shows the done icons at once and puts them back when the write is refused', async () => {
    let answer: (result: TaskBulkOutcome) => void = () => undefined;
    bulk.mockReturnValueOnce(
      new Promise<TaskBulkOutcome>((resolve) => {
        answer = resolve;
      }),
    );
    const fixture: ComponentFixture<ListViewPage> = await render();
    const rows: InstanceType<typeof ListRowsStore> = TestBed.inject(ListRowsStore);
    required(checkbox('Sélectionner CAD-482')).click();
    fixture.detectChanges();
    required(button('Marquer terminé')).click();

    expect(rows.rows().find((row) => row.task.key === 'CAD-482')?.status).toBe('done');
    answer(outcome([], { failed: [{ taskKey: 'CAD-482', version: 3 }] }));
    await settle(fixture);

    expect(rows.rows().find((row) => row.task.key === 'CAD-482')?.status).toBe('todo');
    expect(toasts['error']).toHaveBeenCalledWith('Impossible de modifier la sélection');
  });

  it('does not update the page or show a toast when a bulk action completes after destruction', async () => {
    let finish: (result: TaskBulkOutcome) => void = () => undefined;
    bulk.mockReturnValueOnce(
      new Promise<TaskBulkOutcome>((resolve) => {
        finish = resolve;
      }),
    );
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    fixture.detectChanges();
    required(button('Marquer terminé')).click();
    fixture.destroy();
    finish(outcome(['CAD-482']));
    await Promise.resolve();
    expect(toasts['show']).not.toHaveBeenCalled();
    expect(toasts['warning']).not.toHaveBeenCalled();
    expect(toasts['error']).not.toHaveBeenCalled();
  });

  it('changes the status of a selection through one bulk action', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();
    bulk.mockResolvedValueOnce(outcome(['CAD-482', 'CAD-483']));
    await openRowMenu(fixture, 'CAD-482');
    expect(document.body.textContent).toContain('2 tâches sélectionnées');
    await openSubmenu(fixture, 'Statut');
    expect(document.body.textContent).toContain('Non commencé');
    expect(document.body.textContent).toContain('Actif');
    required(menuItem('Terminé')).click();
    await settle(fixture);

    expect(bulk).toHaveBeenCalledWith(
      [
        { taskKey: 'CAD-482', version: 3 },
        { taskKey: 'CAD-483', version: 3 },
      ],
      { type: 'status', status: 'done' },
      expect.any(Function),
    );
    expect(toasts['show']).toHaveBeenCalledWith('2 tâches · Terminé', {
      description: '2 tâches mises à jour.',
      undo: expect.any(Function) as unknown,
    });
  });

  it('opens the task from the « … » button and its menu from a right click', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const navigate: MockInstance = vi.spyOn(TestBed.inject(Router), 'navigate');
    required(button('Actions sur CAD-482')).click();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { task: 'CAD-482' } }),
    );

    await openRowMenu(fixture, 'CAD-482');
    for (const label of [
      'Ouvrir',
      'Statut',
      'Priorité',
      'Assigner',
      'Me rappeler demain matin',
      'Dupliquer',
      'Copier le lien',
      'Copier l’identifiant',
      'Supprimer la tâche',
    ]) {
      expect(menuItem(label)).toBeDefined();
    }
  });

  it('edits the sprint from the list background menu', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    required(host.querySelector('[data-testid="list-rows"]')).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();

    const labels: readonly string[] = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].map((element: HTMLElement): string => element.textContent.trim());
    expect(labels.at(-1)).toBe('Modifier le sprint');
    required(menuItem('Modifier le sprint')).click();

    expect(openDialog).toHaveBeenCalledOnce();
    expect(openDialog.mock.calls[0]?.[0]).toMatchObject({
      kind: 'list',
      spaceId: 'produit',
      list: { id: 'sprint-14' },
      sprint: true,
    });
  });

  it('sets a priority from the row menu and undoes it with the previous one', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    await openRowMenu(fixture, 'CAD-482');
    await openSubmenu(fixture, 'Priorité');
    required(menuItem('Urgente')).click();
    await settle(fixture);

    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'priority', priority: 'urgente' },
      expect.any(Function),
    );
    expect(toasts['show']).toHaveBeenCalledWith('CAD-482 · priorité urgente', {
      description: 'Priorité modifiée.',
      undo: expect.any(Function) as unknown,
    });
    (toasts['show'].mock.calls[0][1] as { undo: () => void }).undo();
    await settle(fixture);
    expect(bulk).toHaveBeenLastCalledWith(
      [{ taskKey: 'CAD-482', version: 4 }],
      { type: 'priority', priority: 'haute' },
      expect.any(Function),
    );
  });

  it('deletes a task after its confirmation and restores it from the toast', async () => {
    bulk.mockResolvedValueOnce({
      affected: 3,
      done: [{ taskKey: 'CAD-482', version: 4, newTaskKey: null, trashEntryId: 'trash-1' }],
      failed: [],
      unknown: [],
      notSent: [],
    });
    const fixture: ComponentFixture<ListViewPage> = await render();
    await openRowMenu(fixture, 'CAD-482');
    required(menuItem('Supprimer la tâche')).click();
    fixture.detectChanges();
    await settle(fixture);

    expect(document.body.textContent).toContain(
      'Supprimer « Refondre l’écran de connexion SSO » ?',
    );
    required(
      [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
        (element: HTMLButtonElement) => element.textContent.trim() === 'Supprimer la tâche',
      ),
    ).click();
    await settle(fixture);

    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'trash' },
      expect.any(Function),
    );
    expect(toasts['show']).toHaveBeenCalledWith('CAD-482 supprimée', {
      description: 'Avec 2 sous-tâches. Conservées 30 jours dans la corbeille.',
      undo: expect.any(Function) as unknown,
    });
    (toasts['show'].mock.calls[0][1] as { undo: () => void }).undo();
    await settle(fixture);
    expect(restore).toHaveBeenCalledWith('trash-1');
  });

  it('removes a person every selected task has from the selection bar', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const rows: InstanceType<typeof ListRowsStore> = TestBed.inject(ListRowsStore);
    const assigned: TaskSummary = { ...sprintTasks[0], assigneeIds: ['u-ines'] };
    page.mockImplementation((_listId, _query, group) =>
      Promise.resolve({
        items: [assigned, sprintTasks[1]].filter((item) => item.status === group?.value),
        nextCursor: null,
        total: 1,
      }),
    );
    rows.reload();
    await settle(fixture);
    fixture.detectChanges();
    required(checkbox('Sélectionner CAD-482')).click();
    fixture.detectChanges();
    required(button('Assigner')).click();
    fixture.detectChanges();
    await settle(fixture);
    required(menuItem('IR')).click();
    await settle(fixture);

    expect(bulk).toHaveBeenCalledWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'unassign', userId: 'u-ines' },
      expect.any(Function),
    );
    expect(toasts['show']).toHaveBeenCalledWith('Inès Robert retiré', expect.anything());
  });

  it('sends a shared cancellation reason for a selected group', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();
    await openRowMenu(fixture, 'CAD-482');
    await openSubmenu(fixture, 'Statut');
    required(menuItem('Annulé')).click();
    fixture.detectChanges();
    await settle(fixture);
    required(button('Annuler la tâche')).click();
    await settle(fixture);

    expect(bulk).toHaveBeenCalledWith(
      expect.anything(),
      {
        type: 'status',
        status: 'cancelled',
        cancelReason: 'duplicate',
        cancelNote: null,
      },
      expect.any(Function),
    );
    expect(toasts['show']).toHaveBeenCalledWith('CAD-482 annulée', {
      description: 'Motif : Doublon.',
      undo: expect.any(Function) as unknown,
    });
  });

  it('creates from a priority group with its priority', async () => {
    TestBed.inject(ListViewStore).setGroupBy('priority');
    groups.mockResolvedValue([{ value: 'haute', count: 2 }]);
    page.mockResolvedValue({ items: [...sprintTasks], nextCursor: null, total: 2 });
    const open: MockInstance = vi.spyOn(TestBed.inject(TaskCreate), 'open');
    await render();
    required(button('Ajouter une tâche')).click();

    expect(open).toHaveBeenCalledWith({ listId: 'sprint-14', priority: 'haute' });
  });

  it('shows empty groups and creates a task with the selected status', async () => {
    groups.mockResolvedValue([{ value: 'todo', count: 0 }]);
    page.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    const open: MockInstance = vi.spyOn(TestBed.inject(TaskCreate), 'open');
    await render();

    expect(document.body.textContent).toContain('À faire');
    required(button('Ajouter une tâche')).click();

    expect(open).toHaveBeenCalledWith({ listId: 'sprint-14', status: 'todo' });
  });

  it('offers Retry in place when the next page fails', async () => {
    const first: TaskSummary[] = Array.from({ length: 50 }, (_: unknown, index: number) =>
      task(`CAD-${String(400 + index)}`, `Tâche ${String(index)}`, 'todo'),
    );
    page
      .mockResolvedValueOnce({ items: first, nextCursor: 'cursor-2', total: 60 })
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue({ items: [], nextCursor: null, total: 2 });
    const fixture: ComponentFixture<ListViewPage> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const table: CwDataTable<unknown> = fixture.debugElement.query(By.directive(CwDataTable))
      .componentInstance as CwDataTable<unknown>;
    table.nearEnd.emit();
    await settle(fixture);
    fixture.detectChanges();

    const alert: Element | undefined = [...host.querySelectorAll('[role="alert"]')].find(
      (element: Element) =>
        element.textContent.includes('Les tâches suivantes n’ont pas pu être chargées.'),
    );
    expect(alert).toBeDefined();
    const calls: number = page.mock.calls.length;
    required(alert?.querySelector<HTMLButtonElement>('button')).click();
    await settle(fixture);

    expect(page.mock.calls.length).toBeGreaterThan(calls);
    expect(page).toHaveBeenCalledWith(
      'sprint-14',
      expect.anything(),
      expect.objectContaining({ value: 'todo' }),
      'cursor-2',
      50,
      expect.any(AbortSignal),
    );
  });
});
