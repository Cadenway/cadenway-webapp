import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  type InputSignal,
  linkedSignal,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwCellDef,
  CwCellEditorDef,
  type CwCellEditEvent,
  CwDataTable,
  CwDataTableColumn,
  CwDataTableEmpty,
  type CwDataTableTexts,
  CwFooterCellDef,
  type CwSort,
} from '@cadenway/ui/components/data-table';
import { CwEmpty, CwEmptyHeader, CwEmptyMedia, CwEmptyTitle } from '@cadenway/ui/components/empty';
import {
  CwMenu,
  CwMenuItem,
  CwMenuItemCheckbox,
  CwMenuLabel,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { formatDuration } from '@cadenway/ui/components/time-tracker';
import { NgIcon } from '@ng-icons/core';

import {
  type Person,
  PRIORITY_LABELS,
  statusLabel,
  TaskCancelDialog,
  TaskCreate,
  TaskDueDate,
  TaskLabelChips,
  type TaskSummary,
} from '@features/task';

import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import { sheetColumnLabels } from '../../../constants/view-labels/view-labels.constants';
import type { ListTasksRead } from '../../../models/list-tasks/list-tasks.interface';
import type { SheetColumn } from '../../../models/list-view-config/list-view-config.interface';
import type {
  SheetColumnKey,
  SheetCustomField,
  SheetFieldValue,
  SheetOrder,
  SheetRow,
} from '../../../models/sheet-view/sheet-view.interface';
import type { TaskFieldChanges } from '../../../models/view-task-write/view-task-write.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import {
  LIST_TASKS_CAP,
  ListTasksStore,
  type ListTasksStoreInstance,
} from '../../../state/list-tasks/list-tasks.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import {
  SheetViewStore,
  type SheetViewStoreInstance,
} from '../../../state/sheet-view/sheet-view.store';
import {
  ViewTaskWritesStore,
  type ViewTaskWritesStoreInstance,
} from '../../../state/view-task-writes/view-task-writes.store';
import { VIEW_TASK_WRITER } from '../../../state/view-task-writes/view-task-writer.token';
import { fieldColumnKey, fieldIdOf } from '../../../utils/sheet-view/sheet-view.util';
import {
  SheetCellEditor,
  type SheetEditorValue,
} from '../../components/sheet-cell-editor/sheet-cell-editor.component';
import { SheetSpentCell } from '../../components/sheet-spent-cell/sheet-spent-cell.component';
import { TaskMenu } from '../../components/task-menu/task-menu.component';

/**
 * Interface ColumnOption
 *
 * @description
 * A column of the `Columns` menu.
 */
interface ColumnOption {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Column key.
   *
   * @type {SheetColumnKey}
   * @readonly
   */
  readonly key: SheetColumnKey;

  /**
   * Property label
   *
   * @description
   * Column name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property custom
   *
   * @description
   * Whether it is a custom field (`Custom` hint).
   *
   * @type {boolean}
   * @readonly
   */
  readonly custom: boolean;

  /**
   * Property shown
   *
   * @description
   * Whether it shows.
   *
   * @type {boolean}
   * @readonly
   */
  readonly shown: boolean;
  // #endregion
}

/**
 * Constant HIDEABLE_COLUMNS
 *
 * @description
 * The built-in columns the `Columns` menu offers, the name excepted (`TBL_COLS` of
 * `App.dc.html`, not `fixed`).
 *
 * @type {readonly SheetColumn[]}
 */
const HIDEABLE_COLUMNS: readonly SheetColumn[] = [
  'status',
  'priority',
  'people',
  'due',
  'estimate',
  'spent',
  'labels',
  'list',
];

/**
 * Function isSheetRow
 *
 * @description
 * Whether a menu's data is a sheet row.
 *
 * @param {unknown} data - The data.
 * @returns {boolean} Whether it is one.
 */
function isSheetRow(data: unknown): data is SheetRow {
  return typeof data === 'object' && data !== null && 'task' in data && 'id' in data;
}

/**
 * Component SheetViewPage
 *
 * @description
 * The `Sheet` view at `/:org/l/:listId/sheet`, below the list frame (`App.dc.html` lines
 * 1031-1100, 7538-7680 and 7924-7933). The title counts the tasks, sums their estimates (hours)
 * and, when the list has a sprint points field, its points; the hint tells how to edit; the
 * `Columns` menu (`Columns · 2 hidden`) shows or hides each column but the name, custom fields
 * marked `Custom`, and `Show all`, written to the view's presentation. A virtual `cw-data-table`
 * in a bounded height shows one row per task read by `ListTasksStore` with the view's query: the
 * name (the status icon before it, the key, an open button), status, priority, assignees, due
 * date (late icon), estimate, time spent (read for the rendered rows, gap G6), labels, list and
 * the list's custom fields. Headers sort (ascending, descending, none) into the presentation's
 * `sheetSort` or `customFieldSort`. The grid moves with the arrows; Enter or F2 (double click
 * too) edits the name, the due date, the estimate (a bare number means hours) and the custom
 * fields (`Points` refuses a negative number and stays open); Enter validates, Escape cancels,
 * Tab goes to the next editable cell. Each edit goes through the shared writes
 * (`ViewTaskWritesStore.updateFields`, `If-Match`) with a toast and `Undo`; the estimate and custom
 * fields show at once through `SheetViewStore.showEdit`. A right click, Shift + F10 or the row's
 * `…` button opens the shared task menu. The sticky footer counts the tasks and those done and sums
 * the estimates, the time spent (once every row's is read) and the numeric fields. A failed first
 * read reaches the route's error boundary; a failed refresh and failed custom fields show inline
 * with `Retry`; an empty result shows the mockup's filter text. Clicking or pressing Enter on the
 * name opens the task.
 */
@Component({
  selector: 'cw-sheet-view-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwCellDef,
    CwCellEditorDef,
    CwDataTable,
    CwDataTableColumn,
    CwDataTableEmpty,
    CwEmpty,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwFooterCellDef,
    CwMenu,
    CwMenuItem,
    CwMenuItemCheckbox,
    CwMenuLabel,
    CwMenuSeparator,
    CwMenuTriggerFor,
    CwPriorityIcon,
    CwStatusIcon,
    NgIcon,
    SheetCellEditor,
    SheetSpentCell,
    TaskCancelDialog,
    TaskDueDate,
    TaskLabelChips,
    TaskMenu,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  providers: [ViewTaskWritesStore, { provide: VIEW_TASK_WRITER, useExisting: ListTasksStore }],
  templateUrl: './sheet-view-page.component.html',
})
export class SheetViewPage {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list, from the `l/:listId` route parameter.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listId: InputSignal<string> = input.required<string>();

  /**
   * Property retryLabel
   *
   * @description
   * Label for retrying a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property labels
   *
   * @description
   * Names of the built-in columns.
   *
   * @type {Readonly<Record<SheetColumn, string>>}
   * @readonly
   */
  protected readonly labels: Readonly<Record<SheetColumn, string>> = sheetColumnLabels();

  /**
   * Property tableTexts
   *
   * @description
   * The table's name while it loads (`Chargement de la feuille`, `App.dc.html` line 585).
   *
   * @type {Partial<CwDataTableTexts>}
   * @readonly
   */
  protected readonly tableTexts: Partial<CwDataTableTexts> = {
    loading: $localize`:@@spaces.sheet.loading:Loading the sheet`,
  };

  /**
   * Property truncatedText
   *
   * @description
   * The notice of a read that stopped at the cap.
   *
   * @type {string}
   * @readonly
   */
  protected readonly truncatedText: string = ((): string => {
    const count: string = LIST_TASKS_CAP.toLocaleString(inject(LOCALE_ID));
    return $localize`:@@spaces.sheet.truncated:Only the first ${count}:count: tasks are shown.`;
  })();

  /**
   * Property store
   *
   * @description
   * The list frame's store: the list, its members.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property view
   *
   * @description
   * The view's query and presentation.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  protected readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property tasks
   *
   * @description
   * The shared flat reader of the list's tasks.
   *
   * @type {ListTasksStoreInstance}
   * @readonly
   */
  protected readonly tasks: ListTasksStoreInstance = inject(ListTasksStore);

  /**
   * Property sheet
   *
   * @description
   * The sheet's rows, columns, totals and presentation.
   *
   * @type {SheetViewStoreInstance}
   * @readonly
   */
  protected readonly sheet: SheetViewStoreInstance = inject(SheetViewStore);

  /**
   * Property writes
   *
   * @description
   * The task menu's and the inline edits' writes, with their toasts.
   *
   * @type {ViewTaskWritesStoreInstance}
   * @readonly
   */
  protected readonly writes: ViewTaskWritesStoreInstance = inject(ViewTaskWritesStore);

  /**
   * Property locale
   *
   * @description
   * Application locale, for numbers and dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property taskCreate
   *
   * @description
   * Task creation, defaulting to this list while the view lives.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property taskMenu
   *
   * @description
   * The shared task menu.
   *
   * @type {Signal<TaskMenu | undefined>}
   * @readonly
   */
  protected readonly taskMenu: Signal<TaskMenu | undefined> = viewChild(TaskMenu);

  /**
   * Property menuRow
   *
   * @description
   * The row the task menu acts on: the last one it opened on, kept after it closes so an item's
   * action still knows its task.
   *
   * @type {WritableSignal<SheetRow | null>}
   * @readonly
   */
  protected readonly menuRow: WritableSignal<SheetRow | null> = linkedSignal<
    unknown,
    SheetRow | null
  >({
    source: (): unknown => this.taskMenu()?.menu().data(),
    computation: (data: unknown, previous?: { value: SheetRow | null }): SheetRow | null =>
      isSheetRow(data) ? data : (previous?.value ?? null),
  });

  /**
   * Property menuTasks
   *
   * @description
   * The task of the menu, as shown.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const row: SheetRow | null = this.menuRow();
      return row ? [row.task] : [];
    },
  );

  /**
   * Property menuStatus
   *
   * @description
   * The status the menu's task shows.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly menuStatus: Signal<StatusKey | null> = computed(
    (): StatusKey | null => this.menuRow()?.status ?? null,
  );

  /**
   * Property list
   *
   * @description
   * The list shown, once read.
   *
   * @type {Signal<TaskList | null>}
   * @readonly
   */
  protected readonly list: Signal<TaskList | null> = computed((): TaskList | null =>
    this.store.list.hasValue() ? this.store.list.value() : null,
  );

  /**
   * Property tableLabel
   *
   * @description
   * Name of the grid (`Feuille des tâches de …`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly tableLabel: Signal<string> = computed((): string => {
    const name: string = this.list()?.name ?? '';
    return $localize`:@@spaces.sheet.table:Sheet of the tasks of ${name}:name:`;
  });

  /**
   * Property title
   *
   * @description
   * The title: `12 tasks · 18 h · 34 points` (points only with a sprint points field).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    const totals: ReturnType<SheetViewStoreInstance['totals']> = this.sheet.totals();
    const count: string = this.taskCount(totals.count);
    const hours: string = this.hours(totals.estimateMinutes);
    const points: SheetCustomField | undefined = this.sheet
      .customFields()
      .find((field: SheetCustomField) => field.sprintPoints);
    if (!points)
      return $localize`:@@spaces.sheet.title-no-points:${count}:count: · ${hours}:hours:`;
    const sum: string = this.number(totals.fieldSums[points.id] ?? 0);
    return $localize`:@@spaces.sheet.title:${count}:count: · ${hours}:hours: · ${sum}:points: points`;
  });

  /**
   * Property columnsLabel
   *
   * @description
   * The `Columns` button: `Columns`, or `Columns · 2 hidden`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly columnsLabel: Signal<string> = computed((): string => {
    const count: number = this.sheet.hiddenColumns().length;
    if (count === 0) return $localize`:@@spaces.sheet.columns:Columns`;
    return count === 1
      ? $localize`:@@spaces.sheet.columns-hidden-one:Columns · ${count}:count: hidden`
      : $localize`:@@spaces.sheet.columns-hidden:Columns · ${count}:count: hidden`;
  });

  /**
   * Property columnOptions
   *
   * @description
   * The items of the `Columns` menu: the built-in columns but the name, then the custom fields.
   *
   * @type {Signal<readonly ColumnOption[]>}
   * @readonly
   */
  protected readonly columnOptions: Signal<readonly ColumnOption[]> = computed(
    (): readonly ColumnOption[] => {
      const hidden: readonly SheetColumnKey[] = this.sheet.hiddenColumns();
      return [
        ...HIDEABLE_COLUMNS.map((key: SheetColumn): ColumnOption => ({
          key,
          label: this.labels[key],
          custom: false,
          shown: !hidden.includes(key),
        })),
        ...this.sheet.customFields().map((field: SheetCustomField): ColumnOption => {
          const key: SheetColumnKey = fieldColumnKey(field.id);
          return { key, label: field.name, custom: true, shown: !hidden.includes(key) };
        }),
      ];
    },
  );

  /**
   * Property noRows
   *
   * @description
   * The table's rows while its virtual window waits for new custom field columns.
   *
   * @type {readonly SheetRow[]}
   * @readonly
   */
  protected readonly noRows: readonly SheetRow[] = [];

  /**
   * Property fieldSet
   *
   * @description
   * Identity of the list's custom fields, the ids of their columns.
   *
   * @type {Signal<string>}
   * @readonly
   */
  private readonly fieldSet: Signal<string> = computed((): string =>
    this.sheet
      .customFields()
      .map((field: SheetCustomField) => field.id)
      .join(' '),
  );

  /**
   * Property renderedFieldSet
   *
   * @description
   * The custom fields whose columns the table rendered once.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  private readonly renderedFieldSet: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property virtualReady
   *
   * @description
   * Whether the table's columns are all bound: `cw-data-table` 0.10.0 reads a new column child's
   * required `key` in its virtual window before that column's first binding, so the table takes
   * its rows and its virtual window one rendering after the custom field columns change (on the
   * first read and after a Retry), and stays empty in between.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly virtualReady: Signal<boolean> = computed(
    (): boolean => this.renderedFieldSet() === this.fieldSet(),
  );

  /**
   * Property visibility
   *
   * @description
   * The table's hidden columns.
   *
   * @type {Signal<Readonly<Record<string, boolean>>>}
   * @readonly
   */
  protected readonly visibility: Signal<Readonly<Record<string, boolean>>> = computed(
    (): Readonly<Record<string, boolean>> =>
      Object.fromEntries(this.sheet.hiddenColumns().map((key: SheetColumnKey) => [key, false])),
  );

  /**
   * Property tableSort
   *
   * @description
   * The header showing the sheet's order.
   *
   * @type {Signal<readonly CwSort[]>}
   * @readonly
   */
  protected readonly tableSort: Signal<readonly CwSort[]> = computed((): readonly CwSort[] => {
    const order: SheetOrder | null = this.sheet.order();
    return order ? [{ key: order.key, dir: order.direction }] : [];
  });

  /**
   * Property filtered
   *
   * @description
   * Whether the view filters or searches the tasks.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly filtered: Signal<boolean> = computed(
    (): boolean =>
      this.view.filterCount() > 0 || this.view.search().trim() !== '' || this.view.milestonesOnly(),
  );

  /**
   * Property rowId
   *
   * @description
   * Identity of a row: its task key.
   *
   * @type {(row: SheetRow) => string}
   * @readonly
   */
  protected readonly rowId: (row: SheetRow) => string = (row: SheetRow): string => row.id;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the list's tasks with the view's query and the sheet's own data, publishes the visible
   * count and subtask flag to the tools, and makes `N` create in this list while the view lives.
   * A failed first read is retried when the error boundary runs the route again. The table's
   * virtual window opens once its custom field columns rendered (`virtualReady`).
   *
   * @constructor
   */
  public constructor() {
    if (this.tasks.primary.error()) this.tasks.primary.reload();
    this.tasks.load(
      computed((): ListTasksRead => ({ listId: this.listId(), query: this.view.taskQuery() })),
    );
    this.sheet.load(this.listId);
    this.view.followRows(this.tasks.summary);
    this.taskCreate.useDefaults(() => ({ listId: this.listId() }), inject(DestroyRef));
    afterRenderEffect({
      write: (): void => {
        this.renderedFieldSet.set(this.fieldSet());
      },
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method fieldKey
   *
   * @description
   * The column key of a custom field.
   *
   * @param {SheetCustomField} field - The field.
   * @returns {string} The key.
   */
  protected fieldKey(field: SheetCustomField): string {
    return fieldColumnKey(field.id);
  }

  /**
   * Method statusText
   *
   * @description
   * The word of a row's status (the space's name, the milestone word).
   *
   * @param {SheetRow} row - The row.
   * @returns {string} The word.
   */
  protected statusText(row: SheetRow): string {
    return statusLabel(row.status, this.writes.statusOptions(), row.task.milestone);
  }

  /**
   * Method priorityText
   *
   * @description
   * The word of a priority.
   *
   * @param {PriorityKey} priority - The priority.
   * @returns {string} The word.
   */
  protected priorityText(priority: PriorityKey): string {
    return PRIORITY_LABELS[priority];
  }

  /**
   * Method rowPeople
   *
   * @description
   * The known assignees of a row.
   *
   * @param {SheetRow} row - The row.
   * @returns {readonly Person[]} The assignees.
   */
  protected rowPeople(row: SheetRow): readonly Person[] {
    return this.writes
      .people()
      .filter((person: Person) => row.task.assigneeIds.includes(person.id));
  }

  /**
   * Method listText
   *
   * @description
   * The name of a row's list.
   *
   * @param {SheetRow} row - The row.
   * @returns {string} The name, `—` when unknown.
   */
  protected listText(row: SheetRow): string {
    const list: TaskList | null = this.list();
    if (list?.id === row.task.listId) return list.name;
    return this.writes.targets().find((target) => target.listId === row.task.listId)?.name ?? '—';
  }

  /**
   * Method estimateText
   *
   * @description
   * An estimate as shown (`1 h 30`), `—` without one.
   *
   * @param {number | null} minutes - The estimate.
   * @returns {string} The text.
   */
  protected estimateText(minutes: number | null): string {
    return minutes ? formatDuration(minutes * 60_000) : '—';
  }

  /**
   * Method fieldText
   *
   * @description
   * A custom field value as shown, `—` without one.
   *
   * @param {SheetRow} row - The row.
   * @param {SheetCustomField} field - The field.
   * @returns {string} The text.
   */
  protected fieldText(row: SheetRow, field: SheetCustomField): string {
    const value: SheetFieldValue | undefined = row.customFieldValues[field.id];
    if (value === undefined || value === '') return '—';
    return typeof value === 'number' ? this.number(value) : value;
  }

  /**
   * Method draftOf
   *
   * @description
   * What an editor opens with.
   *
   * @param {SheetRow} row - The row.
   * @param {string} key - The column.
   * @returns {string} The draft.
   */
  protected draftOf(row: SheetRow, key: string): string {
    const fieldId: string | null = fieldIdOf(key);
    if (fieldId !== null) {
      const value: SheetFieldValue | undefined = row.customFieldValues[fieldId];
      return value === undefined ? '' : String(value);
    }
    switch (key) {
      case 'name':
        return row.task.name;
      case 'due':
        return row.task.due ?? '';
      case 'estimate':
        return row.estimateMinutes ? formatDuration(row.estimateMinutes * 60_000) : '';
      default:
        return '';
    }
  }

  /**
   * Method editLabel
   *
   * @description
   * Name of an editor (`Estimate of CAD-482`).
   *
   * @param {string} column - The column name.
   * @param {SheetRow} row - The row.
   * @returns {string} The name.
   */
  protected editLabel(column: string, row: SheetRow): string {
    const key: string = row.task.key;
    return $localize`:@@spaces.sheet.edit-label:${column}:column: of ${key}:key:`;
  }

  /**
   * Method openLabel
   *
   * @description
   * Name of the row's open button (`Open CAD-482`).
   *
   * @param {SheetRow} row - The row.
   * @returns {string} The name.
   */
  protected openLabel(row: SheetRow): string {
    const key: string = row.task.key;
    return $localize`:@@spaces.sheet.open:Open ${key}:key:`;
  }

  /**
   * Method actionsLabel
   *
   * @description
   * Name of the row's `…` button.
   *
   * @param {SheetRow} row - The row.
   * @returns {string} The name.
   */
  protected actionsLabel(row: SheetRow): string {
    const key: string = row.task.key;
    return $localize`:@@spaces.rows.actions:Actions on ${key}:key:`;
  }

  /**
   * Method countText
   *
   * @description
   * The footer's task count.
   *
   * @returns {string} `12 tasks`.
   */
  protected countText(): string {
    return this.taskCount(this.sheet.totals().count);
  }

  /**
   * Method doneText
   *
   * @description
   * The footer's tasks done.
   *
   * @returns {string} `3 done`.
   */
  protected doneText(): string {
    const count: number = this.sheet.totals().done;
    return count === 1
      ? $localize`:@@spaces.sheet.done-one:${count}:count: done`
      : $localize`:@@spaces.sheet.done:${count}:count: done`;
  }

  /**
   * Method estimateSum
   *
   * @description
   * The footer's sum of the estimates, in hours.
   *
   * @returns {string} `Σ 18 h`.
   */
  protected estimateSum(): string {
    return this.sum(this.hours(this.sheet.totals().estimateMinutes));
  }

  /**
   * Method spentSum
   *
   * @description
   * The footer's sum of the time spent, blank until every row's is read (gap G6).
   *
   * @returns {string} `Σ 12 h 30`, or empty.
   */
  protected spentSum(): string {
    const minutes: number | null = this.sheet.totals().spentMinutes;
    if (minutes === null) return '';
    return this.sum(formatDuration(minutes * 60_000));
  }

  /**
   * Method fieldSum
   *
   * @description
   * The footer's sum of a numeric field, blank for a text field.
   *
   * @param {SheetCustomField} field - The field.
   * @returns {string} `Σ 34`, or empty.
   */
  protected fieldSum(field: SheetCustomField): string {
    if (field.type !== 'number') return '';
    return this.sum(this.number(this.sheet.totals().fieldSums[field.id] ?? 0));
  }

  /**
   * Method open
   *
   * @description
   * Opens a task's detail over the view (`?task=<KEY>`).
   *
   * @param {SheetRow} row - The row.
   */
  protected open(row: SheetRow): void {
    this.writes.open(row.task.key, row.task);
  }

  /**
   * Method openMenu
   *
   * @description
   * The row's `…` button: opens the task menu on the row.
   *
   * @param {HTMLElement} trigger - The button.
   * @param {SheetRow} row - The row.
   */
  protected openMenu(trigger: HTMLElement, row: SheetRow): void {
    this.taskMenu()?.menu().open({ origin: trigger, trigger, data: row });
  }

  /**
   * Method sortChanged
   *
   * @description
   * A header click: the first criterion becomes the sheet's order, none goes back to the read
   * order.
   *
   * @param {readonly CwSort[]} sort - The sort the table asks for.
   */
  protected sortChanged(sort: readonly CwSort[]): void {
    const first: CwSort | undefined = sort.at(0);
    this.sheet.setOrder(first ? { key: first.key as SheetColumnKey, direction: first.dir } : null);
  }

  /**
   * Method toggleColumn
   *
   * @description
   * An item of the `Columns` menu.
   *
   * @param {ColumnOption} option - The column.
   */
  protected toggleColumn(option: ColumnOption): void {
    this.sheet.setColumnShown(option.key, !option.shown);
  }

  /**
   * Method edited
   *
   * @description
   * An editor validated a value: an unchanged value writes nothing; the name and the due date go
   * through the shared writes (shown at once by the reader), the estimate and custom fields too,
   * shown at once by the sheet; each with its toast and `Undo`.
   *
   * @param {CwCellEditEvent<SheetRow>} event - The edit.
   */
  protected edited(event: CwCellEditEvent<SheetRow>): void {
    const row: SheetRow = event.row;
    const value: SheetEditorValue = event.value as SheetEditorValue;
    const fieldId: string | null = fieldIdOf(event.key);
    if (fieldId !== null) {
      const field: SheetCustomField | undefined = this.sheet
        .customFields()
        .find((item: SheetCustomField) => item.id === fieldId);
      const before: SheetFieldValue | null = row.customFieldValues[fieldId] ?? null;
      if (!field || value === before || (value === null && before === '')) return;
      const customFieldValues: Readonly<Record<string, SheetFieldValue | null>> = {
        [fieldId]: value,
      };
      this.sheet.showEdit(
        row.task.key,
        { customFieldValues },
        this.writes.updateFields(
          row.task,
          { customFieldValues },
          this.toast(row, field.name, value === null ? null : this.fieldValueText(field, value)),
          { customFieldValues: { [fieldId]: before } },
        ),
      );
      return;
    }
    switch (event.key) {
      case 'name':
        if (typeof value !== 'string' || value === row.task.name) return;
        this.write(row, { name: value }, this.toast(row, this.labels.name, value));
        return;
      case 'due':
        if ((value ?? null) === row.task.due || typeof value === 'number') return;
        this.write(
          row,
          { dueDate: value },
          this.toast(row, this.labels.due, value === null ? null : this.dayText(value)),
        );
        return;
      case 'estimate': {
        if (typeof value === 'string' || value === row.estimateMinutes) return;
        const changes: TaskFieldChanges = { estimateMinutes: value };
        this.sheet.showEdit(
          row.task.key,
          changes,
          this.writes.updateFields(
            row.task,
            changes,
            this.toast(row, this.labels.estimate, value === null ? null : this.estimateText(value)),
            { estimateMinutes: row.estimateMinutes },
          ),
        );
        return;
      }
    }
  }

  /**
   * Method write
   *
   * @description
   * A name or due date write.
   *
   * @param {SheetRow} row - The row.
   * @param {TaskFieldChanges} changes - The fields.
   * @param {{ title: string; description: string }} toast - Its toast.
   */
  private write(
    row: SheetRow,
    changes: TaskFieldChanges,
    toast: { title: string; description: string },
  ): void {
    void this.writes.updateFields(row.task, changes, toast);
  }

  /**
   * Method toast
   *
   * @description
   * The toast of an edit: `CAD-482 updated`, then `Estimate: 2 h.` or `Estimate: none.`.
   *
   * @param {SheetRow} row - The row.
   * @param {string} column - The column name.
   * @param {string | null} value - The new value as shown, null when cleared.
   * @returns {{ title: string; description: string }} The toast.
   */
  private toast(
    row: SheetRow,
    column: string,
    value: string | null,
  ): { title: string; description: string } {
    const key: string = row.task.key;
    return {
      title: $localize`:@@spaces.sheet.updated:${key}:key: updated`,
      description:
        value === null
          ? $localize`:@@spaces.sheet.updated-cleared:${column}:column:: none.`
          : $localize`:@@spaces.sheet.updated-value:${column}:column:: ${value}:value:.`,
    };
  }

  /**
   * Method fieldValueText
   *
   * @description
   * A custom field value as a toast writes it.
   *
   * @param {SheetCustomField} field - The field.
   * @param {string | number} value - The value.
   * @returns {string} The text.
   */
  private fieldValueText(field: SheetCustomField, value: string | number): string {
    return typeof value === 'number' ? this.number(value) : value;
  }

  /**
   * Method dayText
   *
   * @description
   * A due date as a toast writes it (`Friday, November 27`).
   *
   * @param {string} day - `YYYY-MM-DD`.
   * @returns {string} The date.
   */
  private dayText(day: string): string {
    const parts: readonly number[] = day.split('-').map(Number);
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  /**
   * Method taskCount
   *
   * @description
   * A number of tasks (`1 task`, `12 tasks`).
   *
   * @param {number} count - The count.
   * @returns {string} The text.
   */
  private taskCount(count: number): string {
    return count === 1
      ? $localize`:@@spaces.sheet.count-one:${count}:count: task`
      : $localize`:@@spaces.sheet.count:${count}:count: tasks`;
  }

  /**
   * Method hours
   *
   * @description
   * Minutes as hours with one decimal (`fmtH` of `App.dc.html`: `18,5 h`).
   *
   * @param {number} minutes - The minutes.
   * @returns {string} The hours.
   */
  private hours(minutes: number): string {
    const hours: string = this.number(minutes / 60);
    return $localize`:@@spaces.sheet.hours:${hours}:hours: h`;
  }

  /**
   * Method number
   *
   * @description
   * A number with one decimal at most, in the locale (`fmtNum` of `App.dc.html`).
   *
   * @param {number} value - The number.
   * @returns {string} The text.
   */
  private number(value: number): string {
    return new Intl.NumberFormat(this.locale, { maximumFractionDigits: 1 }).format(value);
  }

  /**
   * Method sum
   *
   * @description
   * A footer sum (`Σ 18 h`).
   *
   * @param {string} value - The summed value.
   * @returns {string} The text.
   */
  private sum(value: string): string {
    return $localize`:@@spaces.sheet.sum:Σ ${value}:value:`;
  }
  // #endregion
}
