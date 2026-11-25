import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import { TaskCreate, TaskStatusChangesStore, type TaskSummary } from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { LIST_TABLE_TEXTS } from '../../../constants/data-table-texts/data-table-texts.constants';
import { ListTasksApi } from '../../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { BulkOutcome } from '../../../models/bulk-action/bulk-action.interface';
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
  let bulk: Mock<(selection: unknown[], action: unknown) => Promise<BulkOutcome>>;
  let toasts: Record<string, Mock>;

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
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return fixture;
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
    bulk = vi.fn(() =>
      Promise.resolve({
        affected: 1,
        done: [{ taskKey: 'CAD-482', version: 3 }],
        failed: [],
        unknown: [],
        notSent: [],
      }),
    );
    toasts = { show: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn() };
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
            list: ready({ id: 'sprint-14', name: 'Sprint 14' }),
            space: ready({ id: 'produit', statuses: [] }),
            organizationMembers: ready([{ userId: 'u-ines', name: 'Inès Robert' }]),
            bulk,
          },
        },
        {
          provide: SpacesNavigationStore,
          useValue: { spaces: ready([]), overviews: ready({}) },
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
    await fixture.whenStable();
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
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
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
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
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
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.body.textContent).toContain('CAD-483 · Page des quotas d’organisation');
  });

  it('retains rows and selection on a failed refresh and retries in place', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    page.mockRejectedValueOnce(new Error('503'));
    TestBed.inject(ListRowsStore).reload();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 sélectionnée');
    expect(button('Réessayer')).toBeDefined();
    required(button('Réessayer')).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('Réessayer')).toBeUndefined();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('CAD-482');
  });

  it('runs a bulk action on the selection and keeps a refused chunk selected', async () => {
    bulk.mockResolvedValueOnce({
      affected: 1,
      done: [{ taskKey: 'CAD-482', version: 3 }],
      failed: [{ taskKey: 'CAD-483', version: 3 }],
      unknown: [],
      notSent: [],
    });
    const fixture: ComponentFixture<ListViewPage> = await render();

    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 sélectionnées');

    required(button('Marquer terminé')).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(bulk).toHaveBeenCalledWith(
      [
        { taskKey: 'CAD-482', version: 3 },
        { taskKey: 'CAD-483', version: 3 },
      ],
      { type: 'done' },
    );
    expect(toasts['show']).toHaveBeenCalledWith('1 tâche terminée', expect.anything());
    expect(toasts['error']).toHaveBeenCalledWith(
      '1 tâche sur 2 n’a pas pu être modifiée',
      expect.anything(),
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 sélectionnée');
  });

  it('shows the plural toast when two selected tasks are marked done', async () => {
    bulk.mockResolvedValueOnce({
      affected: 2,
      done: [
        { taskKey: 'CAD-482', version: 3 },
        { taskKey: 'CAD-483', version: 3 },
      ],
      failed: [],
      unknown: [],
      notSent: [],
    });
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();

    required(button('Marquer terminé')).click();
    await fixture.whenStable();

    expect(toasts['show']).toHaveBeenCalledWith('2 tâches terminées', expect.anything());
  });

  it('does not update the page or show a toast when a bulk action completes after destruction', async () => {
    let finish: (outcome: BulkOutcome) => void = () => undefined;
    bulk.mockReturnValueOnce(
      new Promise<BulkOutcome>((resolve) => {
        finish = resolve;
      }),
    );
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    fixture.detectChanges();
    required(button('Marquer terminé')).click();
    fixture.destroy();
    finish({
      affected: 1,
      done: [{ taskKey: 'CAD-482', version: 3 }],
      failed: [],
      unknown: [],
      notSent: [],
    });
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
    required(button('Actions sur CAD-482')).click();
    fixture.detectChanges();
    await fixture.whenStable();
    required(button('Statut')).click();
    fixture.detectChanges();
    await fixture.whenStable();
    required(button('En cours')).click();
    await fixture.whenStable();

    expect(bulk).toHaveBeenCalledWith(
      [
        { taskKey: 'CAD-482', version: 3 },
        { taskKey: 'CAD-483', version: 3 },
      ],
      { type: 'status', status: 'progress' },
    );
  });

  it('sends a shared cancellation reason for a selected group', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    required(checkbox('Sélectionner CAD-482')).click();
    required(checkbox('Sélectionner CAD-483')).click();
    fixture.detectChanges();
    required(button('Actions sur CAD-482')).click();
    fixture.detectChanges();
    await fixture.whenStable();
    required(button('Statut')).click();
    fixture.detectChanges();
    await fixture.whenStable();
    required(button('Annulé')).click();
    fixture.detectChanges();
    await fixture.whenStable();
    required(button('Annuler la tâche')).click();
    await fixture.whenStable();

    expect(bulk).toHaveBeenCalledWith(expect.anything(), {
      type: 'status',
      status: 'cancelled',
      cancelReason: 'duplicate',
      cancelNote: null,
    });
  });

  it('distinguishes an empty list, whose button creates in the list', async () => {
    page.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    const open: MockInstance = vi.spyOn(TestBed.inject(TaskCreate), 'open');
    await render();

    expect(document.body.textContent).toContain('Aucune tâche');
    required(button('Ajouter une tâche')).click();

    expect(open).toHaveBeenCalledWith({ listId: 'sprint-14' });
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

    const alert: Element | undefined = [...host.querySelectorAll('[role="alert"]')].find(
      (element: Element) =>
        element.textContent.includes('Les tâches suivantes n’ont pas pu être chargées.'),
    );
    expect(alert).toBeDefined();
    const calls: number = page.mock.calls.length;
    required(alert?.querySelector<HTMLButtonElement>('button')).click();
    await fixture.whenStable();

    expect(page.mock.calls.length).toBeGreaterThan(calls);
    expect(page).toHaveBeenLastCalledWith(
      'sprint-14',
      expect.anything(),
      expect.objectContaining({ value: 'todo' }),
      'cursor-2',
      50,
      expect.any(AbortSignal),
    );
  });
});
