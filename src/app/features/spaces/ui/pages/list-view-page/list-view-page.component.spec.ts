import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import {
  TaskCreate,
  TaskFieldChangesStore,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';
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
   * Function buttons
   *
   * @description
   * Every button of an accessible name in the document.
   *
   * @param {string} name - Their accessible name, `aria-label` or text.
   * @returns {HTMLButtonElement[]} The buttons.
   */
  function buttons(name: string): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
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
    page = vi.fn<ListTasksApi['page']>((_listId, _query, group): Promise<ListTaskPage> =>
      Promise.resolve({
        items: sprintTasks.filter((item: TaskSummary) => item.status === group?.value),
        nextCursor: null,
        total: 1,
      }),
    );
    bulk = vi.fn(() =>
      Promise.resolve({ affected: 1, done: [{ taskKey: 'CAD-482', version: 3 }], failed: [] }),
    );
    toasts = { show: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([]),
        ListViewStore,
        TaskStatusChangesStore,
        TaskFieldChangesStore,
        ListRowsStore,
        LIST_TABLE_TEXTS,
        {
          provide: ListTasksApi,
          useValue: {
            groups: vi.fn(() =>
              Promise.resolve([
                { value: 'todo', count: 1 },
                { value: 'progress', count: 1 },
                { value: 'cancelled', count: 0 },
              ]),
            ),
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

  it('changes the status from the icon at once', async () => {
    const fixture: ComponentFixture<ListViewPage> = await render();
    const advance: string = 'En cours · passer à « En revue »';
    expect(buttons(advance)).toHaveLength(1);

    required(button('À faire · passer à « En cours »')).click();
    fixture.detectChanges();

    expect(button('À faire · passer à « En cours »')).toBeUndefined();
    expect(buttons(advance)).toHaveLength(2);
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

  it('runs a bulk action on the selection and keeps a refused chunk selected', async () => {
    bulk.mockResolvedValueOnce({
      affected: 1,
      done: [{ taskKey: 'CAD-482', version: 3 }],
      failed: [{ taskKey: 'CAD-483', version: 3 }],
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
    expect(toasts['show']).toHaveBeenCalledWith('1 tâches terminées', expect.anything());
    expect(toasts['error']).toHaveBeenCalledWith(
      '1 tâches sur 2 n’ont pas pu être modifiées',
      expect.anything(),
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 sélectionnée');
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
