import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwDataTable } from '@cadenway/ui/components/data-table';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import {
  TaskActionsApi,
  TaskCreate,
  TaskDetailOpener,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { LIST_TABLE_TEXTS } from '../../../constants/data-table-texts/data-table-texts.constants';
import { ListTasksApi } from '../../../data-access/services/list-tasks-api/list-tasks-api.service';
import { SheetTasksApi } from '../../../data-access/services/sheet-tasks-api/sheet-tasks-api.service';
import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import type {
  SheetCustomField,
  SheetRow,
  SheetTaskFacts,
} from '../../../models/sheet-view/sheet-view.interface';
import type { TaskFieldWriteResult } from '../../../models/view-task-write/view-task-write.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListTasksStore } from '../../../state/list-tasks/list-tasks.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SheetViewStore } from '../../../state/sheet-view/sheet-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { SheetViewPage } from './sheet-view-page.component';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {string} name - Its name.
 * @param {Partial<TaskSummary>} [changes] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(key: string, name: string, changes: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name,
    status: 'todo',
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
    spaceId: 'product',
    version: 4,
    ...changes,
  };
}

/**
 * Constant sprintTasks
 *
 * @description
 * Two tasks of Sprint 14, one done.
 *
 * @type {readonly TaskSummary[]}
 */
const sprintTasks: readonly TaskSummary[] = [
  task('CAD-482', 'Redesign the SSO sign-in screen'),
  task('CAD-479', 'Rolling counter of the quotas', { status: 'done' }),
];

/**
 * Constant sprintFacts
 *
 * @description
 * Their estimates and points.
 *
 * @type {readonly SheetTaskFacts[]}
 */
const sprintFacts: readonly SheetTaskFacts[] = [
  { key: 'CAD-482', version: 4, estimateMinutes: 240, customFieldValues: { 'f-points': 5 } },
  { key: 'CAD-479', version: 4, estimateMinutes: 60, customFieldValues: { 'f-points': 3 } },
];

/**
 * Constant points
 *
 * @description
 * The sprint points field of the `Product` space.
 *
 * @type {SheetCustomField}
 */
const points: SheetCustomField = {
  id: 'f-points',
  name: 'Points',
  type: 'number',
  position: 0,
  sprintPoints: true,
};

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

describe('SheetViewPage', () => {
  let facts: Subject<readonly SheetTaskFacts[]>;
  let page: Mock<ListTasksApi['page']>;
  let update: Mock<ListTasksApi['update']>;
  let customFields: Mock<SheetTasksApi['customFields']>;
  let spentMinutes: Mock<SheetTasksApi['spentMinutes']>;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let toasts: Record<string, Mock>;

  /**
   * Function settle
   *
   * @description
   * Waits for the page to be stable and for its promises to run.
   *
   * @param {ComponentFixture<SheetViewPage>} fixture - The page.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(fixture: ComponentFixture<SheetViewPage>): Promise<void> {
    for (let round: number = 0; round < 5; round++) {
      await fixture.whenStable();
      for (let tick: number = 0; tick < 5; tick++) await Promise.resolve();
      fixture.detectChanges();
    }
  }

  /**
   * Function render
   *
   * @description
   * Renders the sheet of Sprint 14 and waits for its rows.
   *
   * @returns {Promise<ComponentFixture<SheetViewPage>>} The fixture.
   */
  async function render(): Promise<ComponentFixture<SheetViewPage>> {
    const fixture: ComponentFixture<SheetViewPage> = TestBed.createComponent(SheetViewPage);
    fixture.componentRef.setInput('listId', 'sprint-14');
    await settle(fixture);
    return fixture;
  }

  /**
   * Function textOf
   *
   * @description
   * The text of the page.
   *
   * @param {ComponentFixture<SheetViewPage>} fixture - The page.
   * @returns {string} Its text.
   */
  function textOf(fixture: ComponentFixture<SheetViewPage>): string {
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  /**
   * Function button
   *
   * @description
   * The button of an accessible name in the document (menus render outside the page).
   *
   * @param {string} name - Its text, which it starts with.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(name: string): HTMLButtonElement | undefined {
    return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (element: HTMLButtonElement): boolean =>
        (element.getAttribute('aria-label') ?? element.textContent.trim()).startsWith(name),
    );
  }

  /**
   * Function table
   *
   * @description
   * The page's data table.
   *
   * @param {ComponentFixture<SheetViewPage>} fixture - The page.
   * @returns {CwDataTable<SheetRow>} The table.
   */
  function table(fixture: ComponentFixture<SheetViewPage>): CwDataTable<SheetRow> {
    return fixture.debugElement.query(By.directive(CwDataTable))
      .componentInstance as CwDataTable<SheetRow>;
  }

  beforeEach(() => {
    facts = new Subject<readonly SheetTaskFacts[]>();
    page = vi.fn<ListTasksApi['page']>((): Promise<ListTaskPage> => {
      facts.next(sprintFacts);
      return Promise.resolve({ items: sprintTasks, nextCursor: null, total: 2 });
    });
    update = vi.fn<ListTasksApi['update']>((): Promise<TaskFieldWriteResult> =>
      Promise.resolve({ kind: 'done', version: 5 }),
    );
    customFields = vi.fn<SheetTasksApi['customFields']>(() => Promise.resolve([points]));
    spentMinutes = vi.fn<SheetTasksApi['spentMinutes']>(() => Promise.resolve(90));
    bulk = vi.fn<TaskActionsApi['bulk']>(() =>
      Promise.resolve({
        affected: 1,
        done: [{ taskKey: 'CAD-482', version: 5, newTaskKey: null, trashEntryId: null }],
        failed: [],
        unknown: [],
        notSent: [],
      }),
    );
    toasts = {
      show: vi.fn(() => 'toast-1'),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      toasts: vi.fn(() => []),
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([]),
        ListViewStore,
        TaskStatusChangesStore,
        {
          provide: SheetTasksApi,
          useValue: {
            facts: facts.asObservable(),
            page,
            update,
            customFields,
            spentMinutes,
            groups: vi.fn(),
            subtasks: vi.fn(() => Promise.resolve([])),
          },
        },
        { provide: ListTasksApi, useExisting: SheetTasksApi },
        ListTasksStore,
        SheetViewStore,
        LIST_TABLE_TEXTS,
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
        {
          provide: TaskActionsApi,
          useValue: { bulk, restore: vi.fn(), remind: vi.fn() },
        },
        {
          provide: SpacesNavigationStore,
          useValue: { spaces: ready([]), overviews: ready({}), openDialog: vi.fn() },
        },
        { provide: TaskApi, useValue: { changeStatus: vi.fn(() => of()), read: vi.fn() } },
        { provide: CwToastService, useValue: toasts },
        { provide: RealtimeConnection, useValue: { watch: () => of() } },
        {
          provide: TaskDetailOpener,
          useValue: { open: vi.fn(), closed: new Subject<string>(), changed: new Subject() },
        },
        {
          provide: TaskCreate,
          useValue: { created: new Subject(), useDefaults: vi.fn(), open: vi.fn() },
        },
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

  it('titles the sheet with the counts and shows the columns, the custom field and the footer', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-testid="sheet-title"]')?.textContent.trim()).toBe(
      '2 tasks · 5 h · 8 points',
    );
    expect(host.querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe(
      'Sheet of the tasks of Sprint 14',
    );
    const headers: string[] = [...host.querySelectorAll('[role="columnheader"]')].map(
      (header: Element) => header.textContent.trim(),
    );
    expect(headers).toEqual(
      expect.arrayContaining(['Name', 'Status', 'Estimate', 'Time spent', 'Points']),
    );
    const text: string = textOf(fixture);
    expect(text).toContain('Redesign the SSO sign-in screen');
    expect(text).toContain('4 h');
    expect(text).toContain('1 done');
    expect(text).toContain('Σ 5 h');
    expect(text).toContain('Σ 8');
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('shows the filter text for a completed read without tasks', async () => {
    page.mockImplementation(() => Promise.resolve({ items: [], nextCursor: null, total: 0 }));
    const fixture: ComponentFixture<SheetViewPage> = await render();
    expect(textOf(fixture)).toContain('No task matches the search or the filters.');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
  });

  it('lets a failed first read reach the error boundary', async () => {
    page.mockImplementation(() => Promise.reject(new Error('unavailable')));
    const fixture: ComponentFixture<SheetViewPage> = TestBed.createComponent(SheetViewPage);
    fixture.componentRef.setInput('listId', 'sprint-14');
    await expect(settle(fixture)).rejects.toThrow();
    expect(textOf(fixture)).not.toContain('No task matches');
  });

  it('shows a failed refresh inline and reads again on Retry', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    page.mockImplementationOnce(() => Promise.reject(new Error('unavailable')));
    TestBed.inject(ListTasksStore).reload();
    await settle(fixture);
    expect(textOf(fixture)).toContain('The tasks could not be refreshed.');
    expect(textOf(fixture)).toContain('Redesign the SSO sign-in screen');
    const calls: number = page.mock.calls.length;
    button('Retry')?.click();
    await settle(fixture);
    expect(page.mock.calls.length).toBe(calls + 1);
    expect(textOf(fixture)).not.toContain('The tasks could not be refreshed.');
  });

  it('keeps the built-in columns when the custom fields fail and reads them again on Retry', async () => {
    customFields.mockRejectedValueOnce(new Error('unavailable'));
    const fixture: ComponentFixture<SheetViewPage> = await render();
    expect(textOf(fixture)).toContain('The custom fields could not be loaded.');
    expect(textOf(fixture)).toContain('Redesign the SSO sign-in screen');
    button('Retry')?.click();
    await settle(fixture);
    expect(customFields).toHaveBeenCalledTimes(2);
    expect(textOf(fixture)).not.toContain('The custom fields could not be loaded.');
    expect(textOf(fixture)).toContain('Σ 8');
  });

  it('writes an inline estimate with If-Match, shows it at once and toasts with Undo', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const row: SheetRow = table(fixture).data()[0];
    table(fixture).cellEdit.emit({ row, key: 'estimate', value: 180, previous: 240 });
    fixture.detectChanges();
    expect(TestBed.inject(SheetViewStore).rows()[0].estimateMinutes).toBe(180);
    await settle(fixture);
    expect(update).toHaveBeenCalledWith('CAD-482', 4, { estimateMinutes: 180 });
    expect(toasts['show']).toHaveBeenCalledWith(
      'CAD-482 updated',
      expect.objectContaining({ description: 'Estimate: 3 h.' }),
    );
  });

  it('edits a cell on a single click, as its hint says', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(table(fixture).editOn()).toBe('click');
    expect(host.textContent.replace(/\s+/gu, ' ')).toContain(
      'Click a cell to edit it · arrows to move · Enter validates, Esc cancels.',
    );
    const cell: HTMLElement | undefined = [
      ...host.querySelectorAll<HTMLElement>('td[data-cw-cell][data-cw-col="estimate"]'),
    ][0];
    expect(cell?.querySelector('cw-sheet-cell-editor')).toBeNull();
    cell?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        host.querySelector('td[data-cw-cell][data-cw-col="estimate"] cw-sheet-cell-editor'),
      ).not.toBeNull();
    });
  });

  it('writes nothing for an unchanged value', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const row: SheetRow = table(fixture).data()[0];
    table(fixture).cellEdit.emit({
      row,
      key: 'name',
      value: row.task.name,
      previous: row.task.name,
    });
    table(fixture).cellEdit.emit({ row, key: 'field:f-points', value: 5, previous: 5 });
    await settle(fixture);
    expect(update).not.toHaveBeenCalled();
  });

  it('hides a column from the Columns menu and sorts from a header, into the presentation', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    button('Columns')?.click();
    await settle(fixture);
    const estimate: HTMLElement | undefined = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
    ].find((element: HTMLElement) => element.textContent.trim() === 'Estimate');
    estimate?.click();
    await settle(fixture);
    const view: InstanceType<typeof ListViewStore> = TestBed.inject(ListViewStore);
    expect(view.presentation().hiddenSheetColumns).toEqual(['estimate']);
    expect(button('Columns')?.textContent.trim()).toBe('Columns · 1 hidden');

    table(fixture).sort.set([{ key: 'status', dir: 'desc' }]);
    await settle(fixture);
    expect(view.presentation().sheetSort).toEqual({ column: 'status', direction: 'desc' });
    expect(
      table(fixture)
        .data()
        .map((item: SheetRow) => item.task.key),
    ).toEqual(['CAD-479', 'CAD-482']);
  });

  it('does not sort by the time spent and totals it only once every row is read', async () => {
    let lastRow: (minutes: number) => void = (): void => undefined;
    spentMinutes.mockImplementation((taskKey: string): Promise<number> =>
      taskKey === 'CAD-479'
        ? new Promise<number>((resolve: (minutes: number) => void) => {
            lastRow = resolve;
          })
        : Promise.resolve(90),
    );
    const view: InstanceType<typeof ListViewStore> = TestBed.inject(ListViewStore);
    view.setPresentation({ sheetSort: { column: 'spent', direction: 'desc' } });
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const header: (name: string) => Element | undefined = (name: string) =>
      [...host.querySelectorAll('[role="columnheader"]')].find(
        (element: Element) => element.textContent.trim() === name,
      );

    expect(header('Time spent')?.getAttribute('aria-sort')).toBeNull();
    expect(header('Estimate')?.getAttribute('aria-sort')).toBe('none');
    expect(
      table(fixture)
        .data()
        .map((item: SheetRow) => item.task.key),
    ).toEqual(['CAD-482', 'CAD-479']);
    expect(host.querySelector('[data-testid="sheet-spent-pending"]')?.textContent).toBe(
      'Total once every row is read',
    );
    expect(textOf(fixture)).not.toContain('Σ 1 h 30');

    lastRow(90);
    await settle(fixture);
    expect(host.querySelector('[data-testid="sheet-spent-pending"]')).toBeNull();
    expect(textOf(fixture)).toContain('Σ 3 h');
  });

  it('groups the rows by the view grouping with Cancelled folded by default', async () => {
    const view: InstanceType<typeof ListViewStore> = TestBed.inject(ListViewStore);
    view.setGroupBy('status');
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const grid: CwDataTable<SheetRow> = table(fixture);
    expect(grid.groupBy()).toBe('group');
    expect(grid.groups().map((group) => [group.value, group.count])).toEqual([
      ['todo', 1],
      ['done', 1],
    ]);
    expect(grid.collapsed()).toEqual(['cancelled']);
    expect(textOf(fixture)).toContain('To do');
  });

  it('acts on the ticked rows from the selection bar', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const first: SheetRow = table(fixture).data()[0];
    expect(first.task.key).toBe('CAD-482');
    table(fixture).selection.set([first.id]);
    await settle(fixture);
    button('Mark done')?.click();
    await settle(fixture);
    expect(bulk).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(bulk.mock.calls[0])).toContain('CAD-482');
    expect(JSON.stringify(bulk.mock.calls[0])).not.toContain('CAD-479');
    expect(table(fixture).selection()).toEqual([]);
  });

  /**
   * Function rowOf
   *
   * @description
   * The table row of a task, failing the test when it is missing.
   *
   * @param {ComponentFixture<SheetViewPage>} fixture - The page.
   * @param {string} key - Task key.
   * @returns {SheetRow} The row.
   */
  function rowOf(fixture: ComponentFixture<SheetViewPage>, key: string): SheetRow {
    const found: SheetRow | undefined = table(fixture)
      .data()
      .find((item: SheetRow) => item.task.key === key);
    if (!found) throw new Error(`No row for ${key}.`);
    return found;
  }

  /**
   * Function undoOf
   *
   * @description
   * The `Undo` of the last toast titled `CAD-482 updated`.
   *
   * @returns {() => void} The `Undo`.
   */
  function undoOf(): () => void {
    const calls: unknown[][] = toasts['show'].mock.calls.filter(
      (call: unknown[]) => call[0] === 'CAD-482 updated',
    );
    const options: { undo?: () => void } | undefined = calls.at(-1)?.[1] as
      { undo?: () => void } | undefined;
    expect(options?.undo).toBeTypeOf('function');
    return options?.undo ?? ((): void => undefined);
  }

  /**
   * Function refuseFirstWrite
   *
   * @description
   * Holds the first single-field write until the returned function refuses it; later writes
   * apply at versions 5, 6 and on.
   *
   * @returns {() => void} Refuses the first write.
   */
  function refuseFirstWrite(): () => void {
    let refuse: (result: TaskFieldWriteResult) => void = (): void => undefined;
    let version: number = 4;
    update.mockImplementation((): Promise<TaskFieldWriteResult> => {
      if (version === 4) {
        version++;
        return new Promise<TaskFieldWriteResult>(
          (resolve: (result: TaskFieldWriteResult) => void) => {
            refuse = resolve;
          },
        );
      }
      return Promise.resolve({ kind: 'done', version: version++ });
    });
    return (): void => {
      refuse({ kind: 'refused', stale: false });
    };
  }

  it('undoes a queued estimate edit to the original value when the first edit was refused', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const refuse: () => void = refuseFirstWrite();
    const row: () => SheetRow = (): SheetRow => rowOf(fixture, 'CAD-482');
    table(fixture).cellEdit.emit({ row: row(), key: 'estimate', value: 180, previous: 240 });
    fixture.detectChanges();
    table(fixture).cellEdit.emit({ row: row(), key: 'estimate', value: 120, previous: 180 });
    fixture.detectChanges();
    refuse();
    await settle(fixture);
    expect(update).toHaveBeenNthCalledWith(2, 'CAD-482', 4, { estimateMinutes: 120 });

    undoOf()();
    await settle(fixture);
    expect(update).toHaveBeenLastCalledWith('CAD-482', 5, { estimateMinutes: 240 });
  });

  it('undoes a queued custom field edit to the original value when the first edit was refused', async () => {
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const refuse: () => void = refuseFirstWrite();
    const row: () => SheetRow = (): SheetRow => rowOf(fixture, 'CAD-482');
    table(fixture).cellEdit.emit({ row: row(), key: 'field:f-points', value: 3, previous: 5 });
    fixture.detectChanges();
    table(fixture).cellEdit.emit({ row: row(), key: 'field:f-points', value: 8, previous: 3 });
    fixture.detectChanges();
    refuse();
    await settle(fixture);
    expect(update).toHaveBeenNthCalledWith(2, 'CAD-482', 4, {
      customFieldValues: { 'f-points': 8 },
    });

    undoOf()();
    await settle(fixture);
    expect(update).toHaveBeenLastCalledWith('CAD-482', 5, {
      customFieldValues: { 'f-points': 5 },
    });
  });

  it('offers a retry in the time spent cell after a failed read', async () => {
    spentMinutes.mockImplementation((taskKey: string): Promise<number> =>
      taskKey === 'CAD-479' ? Promise.reject(new Error('unavailable')) : Promise.resolve(90),
    );
    const fixture: ComponentFixture<SheetViewPage> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="sheet-spent-pending"]')).not.toBeNull();
    const retry: HTMLButtonElement | undefined = [
      ...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Retry"]'),
    ].at(0);
    expect(retry).toBeDefined();

    spentMinutes.mockImplementation((): Promise<number> => Promise.resolve(90));
    retry?.click();
    await settle(fixture);
    expect(spentMinutes.mock.calls.filter((call) => call[0] === 'CAD-479')).toHaveLength(2);
    expect(host.querySelector('button[aria-label="Retry"]')).toBeNull();
    expect(textOf(fixture)).toContain('Σ 3 h');
  });
});
