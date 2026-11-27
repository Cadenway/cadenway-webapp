import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  type InputSignal,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import {
  CwCellDef,
  CwDataTable,
  CwDataTableColumn,
  CwDataTableEmpty,
  CwDataTableGroup,
  type CwDataTableSelection,
  type CwGroupDef,
  type CwSort,
} from '@cadenway/ui/components/data-table';
import { CwEmpty, CwEmptyHeader, CwEmptyMedia, CwEmptyTitle } from '@cadenway/ui/components/empty';
import {
  CwMenu,
  CwMenuItem,
  CwMenuLabel,
  CwMenuSeparator,
  CwMenuShortcut,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';

import {
  initialsOf,
  type Person,
  PRIORITY_LABELS,
  type StatusOption,
  TaskCancelDialog,
  TaskCreate,
  TaskDetailOpener,
  TaskDueDate,
  TaskLabelChips,
  TaskMenu,
  type TaskStatusChangesInstance,
  TaskStatusChangesStore,
  type TaskSummary,
  TaskTitleCell,
} from '@features/task';

import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import { groupLabels, sortLabels } from '../../../constants/view-labels/view-labels.constants';
import type { ListExport } from '../../../data-access/services/lists-api/lists-api.service';
import type { ListRow, ListRowsQuery } from '../../../models/list-rows/list-rows.interface';
import type {
  ListGroupBy,
  ListSortField,
} from '../../../models/list-view-config/list-view-config.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListRowsStore } from '../../../state/list-rows/list-rows.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import {
  ViewTaskWritesStore,
  type ViewTaskWritesStoreInstance,
} from '../../../state/view-task-writes/view-task-writes.store';
import { VIEW_TASK_WRITER } from '../../../state/view-task-writes/view-task-writer.token';
import { saveTextFile } from '../../../utils/file-download/file-download.util';
import { NO_ASSIGNEE_GROUP } from '../../../utils/list-rows/list-rows.util';
import { BulkBar, type BulkPerson } from '../../components/bulk-bar/bulk-bar.component';

/**
 * Constant DEFAULT_STATUS_GROUPS
 *
 * @description
 * Status groups shown when empty in the unfiltered mockup list.
 *
 * @type {readonly string[]}
 */
const DEFAULT_STATUS_GROUPS: readonly string[] = ['progress', 'review', 'todo', 'blocked', 'done'];

/**
 * Constant STATUS_FROM_MS
 *
 * @description
 * How long a row's status icon keeps the status it animates from, in milliseconds: the icon's
 * transition, so a row drawn again later does not replay it.
 *
 * @type {number}
 */
const STATUS_FROM_MS: number = 600;

/**
 * Function csvRecordCount
 *
 * @description
 * Rows of a CSV file, header left out; line breaks inside quoted fields do not count.
 *
 * @param {string} content - CSV text.
 * @returns {number} The row count.
 */
function csvRecordCount(content: string): number {
  let quoted: boolean = false;
  let records: number = 0;
  let filled: boolean = false;
  for (const character of content) {
    if (character === '"') quoted = !quoted;
    if (character === '\n' && !quoted) {
      if (filled) records += 1;
      filled = false;
    } else if (character !== '\r') {
      filled = true;
    }
  }
  if (filled) records += 1;
  return Math.max(0, records - 1);
}

/**
 * Component ListViewPage
 *
 * @description
 * The `List` view of a list (`/:org/l/:listId/list`): the grouped task rows of `ListRowsStore`
 * in a virtualized `cw-data-table`, read page by page as the table scrolls. A row shows the
 * status and the name (`cw-task-title-cell`, the icon animating from the previous status), the
 * assignees, the due date, the priority (`Urgent` in red) and the labels. A click on the name,
 * Enter or the `…` button opens the task's detail over the view (`?task=<KEY>`); a right
 * click, the Menu key or Shift F10 on a row opens its menu, which acts on the selection when the
 * row is selected: `Open`, `Status` (by category, with hints), `Priority`, `Assign`,
 * `Move to`, the reminder, `Duplicate`, the two copies and `Delete`. A right click
 * elsewhere in the view opens the list menu (`New task`, `Group by`, `Sort by`,
 * `Select all`, `Export as CSV`). `name` sorts by name. Each group's add row presets
 * its status, priority or assignee; `N` creates in this list. The selection fills the selection
 * bar. The row menu is the shared `cw-task-menu`; its writes and the selection bar's go through
 * the page-scoped `ViewTaskWritesStore` over `ListRowsStore` (`VIEW_TASK_WRITER`): the rows change
 * at once, a refusal puts them back, and the toast's `Undo` sends the reverse write of the values
 * confirmed before the action (a deletion restores the trash entries), reported like the action;
 * leaving the view dismisses those toasts. Under 768 px the rows keep the name and the due date. A failed first read reaches the
 * route's error boundary; a failed next page or subtask read offers `Retry` in place.
 */
@Component({
  selector: 'cw-list-view-page',
  imports: [
    BulkBar,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwCellDef,
    CwContextMenuTriggerFor,
    CwDataTable,
    CwDataTableColumn,
    CwDataTableEmpty,
    CwDataTableGroup,
    CwEmpty,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwMenu,
    CwMenuItem,
    CwMenuLabel,
    CwMenuSeparator,
    CwMenuShortcut,
    CwMenuTriggerFor,
    CwPriorityIcon,
    CwStatusIcon,
    NgIcon,
    TaskCancelDialog,
    TaskDueDate,
    TaskLabelChips,
    TaskMenu,
    TaskTitleCell,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  providers: [ViewTaskWritesStore, { provide: VIEW_TASK_WRITER, useExisting: ListRowsStore }],
  templateUrl: './list-view-page.component.html',
})
export class ListViewPage {
  // #region Properties
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
   * Property groupOptions
   *
   * @description
   * `Group by` of the list menu: `Status`, `Priority`, `Assignee`, `None`.
   *
   * @type {readonly { value: ListGroupBy; label: string }[]}
   * @readonly
   */
  protected readonly groupOptions: readonly { value: ListGroupBy; label: string }[] = ((): {
    value: ListGroupBy;
    label: string;
  }[] => {
    const labels: ReturnType<typeof groupLabels> = groupLabels();
    return [
      { value: 'status', label: labels.status },
      { value: 'priority', label: labels.priority },
      { value: 'assignee', label: labels.assignee },
      { value: null, label: labels.none },
    ];
  })();

  /**
   * Property sortOptions
   *
   * @description
   * `Sort by` of the list menu, in the mockup's order.
   *
   * @type {readonly { value: ListSortField; label: string }[]}
   * @readonly
   */
  protected readonly sortOptions: readonly { value: ListSortField; label: string }[] = ((): {
    value: ListSortField;
    label: string;
  }[] => {
    const labels: Readonly<Record<ListSortField, string>> = sortLabels();
    return (['manual', 'dueDate', 'priority', 'name', 'createdAt'] as const).map(
      (value: ListSortField) => ({ value, label: labels[value] }),
    );
  })();

  /**
   * Property listId
   *
   * @description
   * The open list, from the route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listId: InputSignal<string> = input.required<string>();

  /**
   * Property store
   *
   * @description
   * The open list.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property view
   *
   * @description
   * The view configuration: query, grouping, sort, subtask display and search.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  protected readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property rows
   *
   * @description
   * The rows of the view and their writes.
   *
   * @type {InstanceType<typeof ListRowsStore>}
   * @readonly
   */
  protected readonly rows: InstanceType<typeof ListRowsStore> = inject(ListRowsStore);

  /**
   * Property writes
   *
   * @description
   * The writes of the task menu and the selection bar, with their toasts and confirmations,
   * page-scoped over the rows (`VIEW_TASK_WRITER`).
   *
   * @type {ViewTaskWritesStoreInstance}
   * @readonly
   */
  protected readonly writes: ViewTaskWritesStoreInstance = inject(ViewTaskWritesStore);

  /**
   * Property statusChanges
   *
   * @description
   * The status changes of the rows and their cancel reason dialog.
   *
   * @type {TaskStatusChangesInstance}
   * @readonly
   */
  protected readonly statusChanges: TaskStatusChangesInstance = inject(TaskStatusChangesStore);

  /**
   * Property navigation
   *
   * @description
   * The workspace's navigation, for the destinations of a move and the list dialog.
   *
   * @type {InstanceType<typeof SpacesNavigationStore>}
   * @readonly
   */
  private readonly navigation: InstanceType<typeof SpacesNavigationStore> =
    inject(SpacesNavigationStore);

  /**
   * Property destroyRef
   *
   * @description
   * Prevents a completed asynchronous action from updating a destroyed page.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property taskCreate
   *
   * @description
   * The task create dialog.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property toasts
   *
   * @description
   * The shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property taskDetail
   *
   * @description
   * Opens a task's detail over the view, in the address.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property document
   *
   * @description
   * Document of the downloads and of the clipboard.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property host
   *
   * @description
   * The page element, used to restore focus after a row moves.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property dueWidth
   *
   * @description
   * Due-date column width in pixels at the phone and desktop breakpoints.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly dueWidth: Signal<number> = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((state) => (state.matches ? 88 : 120))),
    { initialValue: 120 },
  );

  /**
   * Property tableSelection
   *
   * @description
   * Row ids ticked in the table, or `all`.
   *
   * @type {WritableSignal<CwDataTableSelection>}
   * @readonly
   */
  protected readonly tableSelection: WritableSignal<CwDataTableSelection> =
    signal<CwDataTableSelection>([]);

  /**
   * Property selectedTasks
   *
   * @description
   * The ticked tasks, each once even when grouping by assignee shows it twice.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly selectedTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const ticked: CwDataTableSelection = this.tableSelection();
      const tasks: Map<string, TaskSummary> = new Map<string, TaskSummary>();
      for (const row of this.rows.rows()) {
        if (ticked === 'all' || ticked.includes(row.id)) tasks.set(row.task.key, row.task);
      }
      return [...tasks.values()];
    },
  );

  /**
   * Property menuRow
   *
   * @description
   * The row whose menu opened last.
   *
   * @type {WritableSignal<ListRow | null>}
   * @readonly
   */
  protected readonly menuRow: WritableSignal<ListRow | null> = signal<ListRow | null>(null);

  /**
   * Property menuTasks
   *
   * @description
   * What the row menu acts on: the selection when the row belongs to a selection of several
   * tasks, else the row's task (as in `App.dc.html`).
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const row: ListRow | null = this.menuRow();
      if (!row) return [];
      const selected: readonly TaskSummary[] = this.selectedTasks();
      return selected.length > 1 && selected.some((task: TaskSummary) => task.key === row.task.key)
        ? selected
        : [row.task];
    },
  );

  /**
   * Property menuStatus
   *
   * @description
   * The status every task of the menu shows, or null when they differ.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly menuStatus: Signal<StatusKey | null> = computed((): StatusKey | null => {
    const statuses: Set<StatusKey> = new Set<StatusKey>(
      this.menuTasks().map((task: TaskSummary) => this.rows.shownStatus(task)),
    );
    return statuses.size === 1 ? [...statuses][0] : null;
  });

  /**
   * Property menuMilestone
   *
   * @description
   * Whether every task of the menu is a milestone, which offers a milestone's four statuses.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly menuMilestone: Signal<boolean> = computed((): boolean => {
    const tasks: readonly TaskSummary[] = this.menuTasks();
    return tasks.length > 0 && tasks.every((task: TaskSummary): boolean => task.milestone);
  });

  /**
   * Property bulkPeople
   *
   * @description
   * People of the selection bar's `Assign`, ticked when every selected task has them.
   *
   * @type {Signal<readonly BulkPerson[]>}
   * @readonly
   */
  protected readonly bulkPeople: Signal<readonly BulkPerson[]> = computed(
    (): readonly BulkPerson[] => {
      const selected: readonly TaskSummary[] = this.selectedTasks();
      return this.writes.people().map((person: Person): BulkPerson => ({
        id: person.id,
        name: person.name,
        initials: person.initials,
        assigned:
          selected.length > 0 &&
          selected.every((task: TaskSummary): boolean => task.assigneeIds.includes(person.id)),
      }));
    },
  );

  /**
   * Property list
   *
   * @description
   * The open list, once read.
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
   * Accessible name of the table (`Tasks of the list Sprint 14`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly tableLabel: Signal<string> = computed((): string => {
    const name: string = this.list()?.name ?? '';
    return $localize`:@@spaces.rows.table:Tasks of the list ${name}:name:`;
  });

  /**
   * Property separate
   *
   * @description
   * Whether subtasks show `Apart, as tasks`, with their parent's key.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly separate: Signal<boolean> = computed(
    (): boolean => this.view.config().subtasks === 'separate',
  );

  /**
   * Property filtered
   *
   * @description
   * Whether a filter, the search or `Milestones` narrows the rows.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly filtered: Signal<boolean> = computed(
    (): boolean =>
      this.view.filterCount() > 0 || this.view.search().trim() !== '' || this.view.milestonesOnly(),
  );

  /**
   * Property tableSort
   *
   * @description
   * The sort the `name` header shows: by name when the view sorts by name, else none.
   *
   * @type {Signal<readonly CwSort[]>}
   * @readonly
   */
  protected readonly tableSort: Signal<readonly CwSort[]> = computed((): readonly CwSort[] => {
    const sort: { field: ListSortField; direction: 'asc' | 'desc' } = this.view.config().sort;
    return sort.field === 'name' ? [{ key: 'name', dir: sort.direction }] : [];
  });

  /**
   * Property loadedCount
   *
   * @description
   * Tasks the view has read, each once (`Select all` of the list menu).
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly loadedCount: Signal<number> = computed(
    (): number => new Set(this.rows.rows().map((row: ListRow) => row.task.key)).size,
  );

  /**
   * Property statusFrom
   *
   * @description
   * The status each row's icon animates from, for a moment after its status changed.
   *
   * @type {WritableSignal<ReadonlyMap<string, StatusKey>>}
   * @readonly
   */
  protected readonly statusFrom: WritableSignal<ReadonlyMap<string, StatusKey>> = signal(
    new Map<string, StatusKey>(),
  );

  /**
   * Property rowId
   *
   * @description
   * Identity of a row in the table.
   *
   * @type {(row: ListRow) => string}
   * @readonly
   */
  protected readonly rowId: (row: ListRow) => string = (row: ListRow): string => row.id;

  /**
   * Property rowLabel
   *
   * @description
   * Short name of a row for its checkbox (`Select CAD-482`).
   *
   * @type {(row: ListRow) => string}
   * @readonly
   */
  protected readonly rowLabel: (row: ListRow) => string = (row: ListRow): string => row.task.key;

  /**
   * Property groupLabel
   *
   * @description
   * Name of a group: the space's status name, the priority word, the member's name,
   * `Unassigned` or `All tasks`.
   *
   * @type {(key: string) => string}
   * @readonly
   */
  protected readonly groupLabel: (key: string) => string = (key: string): string => {
    switch (this.rows.groupBy()) {
      case 'status':
        return (
          this.writes.statusOptions().find((option: StatusOption): boolean => option.key === key)
            ?.label ?? key
        );
      case 'priority':
        return PRIORITY_LABELS[key as PriorityKey];
      case 'assignee':
        return key === NO_ASSIGNEE_GROUP
          ? $localize`:@@spaces.rows.unassigned:Unassigned`
          : (this.writes.people().find((person: Person): boolean => person.id === key)?.name ??
              key);
      case null:
        return $localize`:@@spaces.rows.all:All tasks`;
    }
  };

  /**
   * Property tableRows
   *
   * @description
   * Rows constrained to the gateway groups when the grouped field has a filter.
   *
   * @type {Signal<readonly ListRow[]>}
   * @readonly
   */
  protected readonly tableRows: Signal<readonly ListRow[]> = computed(() => {
    const grouping: 'status' | 'priority' | 'assignee' | null = this.rows.groupBy();
    const selected: readonly string[] | undefined =
      grouping === null ? undefined : this.view.taskQuery()[grouping];
    if (!selected?.length) return this.rows.rows();
    const groups: ReadonlySet<string> = new Set(this.rows.groupOrder());
    return this.rows.rows().filter((row) => groups.has(row.group));
  });

  /**
   * Property tableGroups
   *
   * @description
   * Visible groups with server counts, including empty default status groups.
   *
   * @type {Signal<readonly CwGroupDef[]>}
   * @readonly
   */
  protected readonly tableGroups: Signal<readonly CwGroupDef[]> = computed(() => {
    const grouping: 'status' | 'priority' | 'assignee' | null = this.rows.groupBy();
    const loaded: ReadonlySet<string> = new Set(this.tableRows().map((row) => row.group));
    return this.rows
      .groupOrder()
      .filter((value) => {
        const hidden: boolean =
          grouping === 'status' &&
          this.writes.statusOptions().some((option) => option.key === value && option.hidden);
        return (
          !hidden &&
          ((this.rows.groupCount(value) ?? 0) > 0 ||
            loaded.has(value) ||
            (grouping === 'status' && !this.filtered() && DEFAULT_STATUS_GROUPS.includes(value)))
        );
      })
      .map((value) => ({
        value,
        label: this.groupLabel(value),
        count: this.rows.groupCount(value) ?? undefined,
      }));
  });

  /**
   * Property rowMotion
   *
   * @description
   * Requests entry motion for rows that have just changed groups.
   *
   * @type {(row: ListRow) => 'in' | null}
   * @readonly
   */
  protected readonly rowMotion: (row: ListRow) => 'in' | null = (row) =>
    row.entering ? 'in' : null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the rows of the list with the view's query, follows the subtask display and the
   * space's hidden statuses and makes `N` create in this list while the view lives. Remembers the
   * status each row changed from, for its icon, and keeps the focus on a row that moved. A failed
   * first read is retried when the error boundary runs the route again.
   *
   * @constructor
   */
  public constructor() {
    if (this.rows.primary.error()) this.rows.primary.reload();
    this.rows.load(
      computed((): ListRowsQuery => ({
        listId: this.listId(),
        query: this.view.taskQuery(),
        groupQuery: this.view.groupQuery(),
      })),
    );
    this.rows.useSubtasks(computed(() => this.view.config().subtasks));
    this.view.followRows(this.rows.summary);
    this.rows.hideStatuses(
      computed((): readonly string[] =>
        this.writes
          .statusOptions()
          .filter((option: StatusOption): boolean => option.hidden)
          .map((option: StatusOption): string => option.key),
      ),
    );
    this.taskCreate.useDefaults(() => ({ listId: this.listId() }), this.destroyRef);
    const element: HTMLElement = this.host.nativeElement;
    const delegate: (event: Event) => void = (event: Event): void => {
      this.delegateRowMenu(event);
    };
    element.addEventListener('contextmenu', delegate, true);
    element.addEventListener('keydown', delegate, true);
    this.destroyRef.onDestroy((): void => {
      element.removeEventListener('contextmenu', delegate, true);
      element.removeEventListener('keydown', delegate, true);
    });

    let previousGroups: Map<string, string> = new Map<string, string>();
    let previousStatuses: Map<string, StatusKey> = new Map<string, StatusKey>();
    let restoreFocus: { key: string; element: Element } | null = null;
    const timers: Set<ReturnType<typeof setTimeout>> = new Set<ReturnType<typeof setTimeout>>();
    this.destroyRef.onDestroy((): void => {
      for (const timer of timers) clearTimeout(timer);
    });
    this.writes.onRefused((taskKeys: readonly string[]): void => {
      this.tableSelection.set(
        this.rows
          .rows()
          .filter((row: ListRow): boolean => taskKeys.includes(row.task.key))
          .map((row: ListRow): string => row.id),
      );
    });
    effect((): void => {
      const current: readonly ListRow[] = this.rows.rows();
      const active: Element | null = this.host.nativeElement.ownerDocument.activeElement;
      const key: string | undefined =
        active?.closest<HTMLElement>('[data-task-row]')?.dataset['taskRow'];
      const row: ListRow | undefined = current.find((item: ListRow) => item.task.key === key);
      if (
        key &&
        row &&
        previousGroups.has(key) &&
        previousGroups.get(key) !== row.group &&
        active
      ) {
        restoreFocus = { key, element: active };
      }
      const changed: [string, StatusKey][] = current.flatMap(
        (item: ListRow): [string, StatusKey][] => {
          const before: StatusKey | undefined = previousStatuses.get(item.task.key);
          return before !== undefined && before !== item.status ? [[item.task.key, before]] : [];
        },
      );
      if (changed.length > 0) {
        untracked((): void => {
          this.statusFrom.update(
            (from: ReadonlyMap<string, StatusKey>) => new Map([...from, ...changed]),
          );
        });
        const timer: ReturnType<typeof setTimeout> = setTimeout((): void => {
          timers.delete(timer);
          this.statusFrom.update((from: ReadonlyMap<string, StatusKey>) => {
            const next: Map<string, StatusKey> = new Map<string, StatusKey>(from);
            for (const [taskKey] of changed) next.delete(taskKey);
            return next;
          });
        }, STATUS_FROM_MS);
        timers.add(timer);
      }
      previousGroups = new Map(current.map((item: ListRow) => [item.task.key, item.group]));
      previousStatuses = new Map(current.map((item: ListRow) => [item.task.key, item.status]));
    });
    afterRenderEffect((): void => {
      if (this.rows.rows().length === 0) return;
      untracked((): void => {
        if (restoreFocus) {
          const document: Document = this.host.nativeElement.ownerDocument;
          const active: Element | null = document.activeElement;
          if (active === restoreFocus.element || active === document.body) {
            const row: HTMLElement | undefined = [
              ...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-task-row]'),
            ].find((element: HTMLElement) => element.dataset['taskRow'] === restoreFocus?.key);
            row?.querySelector<HTMLButtonElement>('cw-task-title-cell button')?.focus();
          }
          restoreFocus = null;
        }
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method statusOf
   *
   * @description
   * A group value as a status key, for the group header icon.
   *
   * @param {string} key - The group value.
   * @returns {StatusKey} The status.
   */
  protected statusOf(key: string): StatusKey {
    return key as StatusKey;
  }

  /**
   * Method priorityOf
   *
   * @description
   * A group value as a priority, for the group header icon.
   *
   * @param {string} key - The group value.
   * @returns {PriorityKey} The priority.
   */
  protected priorityOf(key: string): PriorityKey {
    return key as PriorityKey;
  }

  /**
   * Method groupInitials
   *
   * @description
   * Initials of an assignee group (`—` for `Unassigned`).
   *
   * @param {string} key - The group value.
   * @returns {string} The initials.
   */
  protected groupInitials(key: string): string {
    if (key === NO_ASSIGNEE_GROUP) return '—';
    const person: Person | undefined = this.writes.people().find((item: Person) => item.id === key);
    return person ? person.initials : initialsOf(key);
  }

  /**
   * Method subtasksLabel
   *
   * @description
   * Name of the caret of a row's subtasks (`Show the 3 subtasks of CAD-482`).
   *
   * @param {ListRow} row - The row.
   * @returns {string} The label.
   */
  protected subtasksLabel(row: ListRow): string {
    const count: number = row.task.subtasks.total;
    const key: string = row.task.key;
    return row.expanded
      ? $localize`:@@spaces.rows.hide-subtasks:Hide the ${count}:count: subtasks of ${key}:key:`
      : $localize`:@@spaces.rows.show-subtasks:Show the ${count}:count: subtasks of ${key}:key:`;
  }

  /**
   * Method actionsLabel
   *
   * @description
   * Name of a row's `…` button (`Actions on CAD-482`).
   *
   * @param {ListRow} row - The row.
   * @returns {string} The label.
   */
  protected actionsLabel(row: ListRow): string {
    const key: string = row.task.key;
    return $localize`:@@spaces.rows.actions:Actions on ${key}:key:`;
  }

  /**
   * Method selectAllHint
   *
   * @description
   * Hint of `Select all`: the tasks read (`12 tasks`).
   *
   * @returns {string} The hint.
   */
  protected selectAllHint(): string {
    const count: number = this.loadedCount();
    return count === 1
      ? $localize`:@@spaces.rows.count-one:${count}:count: task`
      : $localize`:@@spaces.rows.count-many:${count}:count: tasks`;
  }

  /**
   * Method open
   *
   * @description
   * Opens a task's detail over the view (`?task=<KEY>`, Task's `TaskDetailOpener`), keeping the
   * view and its other parameters; the row gives what it shows of the task, for the header while
   * the detail is read.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskSummary} [task] - The row's task.
   */
  protected open(taskKey: string, task?: TaskSummary): void {
    void this.taskDetail.open(
      taskKey,
      task
        ? { key: task.key, name: task.name, status: task.status, milestone: task.milestone }
        : undefined,
    );
  }

  /**
   * Method sortChanged
   *
   * @description
   * The `name` header: ascending, then descending, then ascending again (`sortByName` of
   * `App.dc.html`).
   *
   * @param {readonly CwSort[]} sort - The sort the table asks for.
   */
  protected sortChanged(sort: readonly CwSort[]): void {
    const direction: 'asc' | 'desc' =
      sort.find((item: CwSort) => item.key === 'name')?.dir ?? 'asc';
    this.view.setSort('name');
    if (this.view.config().sort.direction !== direction) this.view.toggleSortDirection();
  }

  /**
   * Method setGroupBy
   *
   * @description
   * `Group by` of the list menu.
   *
   * @param {ListGroupBy} groupBy - The grouping.
   */
  protected setGroupBy(groupBy: ListGroupBy): void {
    this.view.setGroupBy(groupBy);
  }

  /**
   * Method setSortField
   *
   * @description
   * `Sort by` of the list menu, keeping the direction.
   *
   * @param {ListSortField} field - The criterion.
   */
  protected setSortField(field: ListSortField): void {
    this.view.setSort(field);
  }

  /**
   * Method selectAll
   *
   * @description
   * `Select all` of the list menu: ticks every row read.
   */
  protected selectAll(): void {
    this.tableSelection.set(this.rows.rows().map((row: ListRow): string => row.id));
  }

  /**
   * Method editList
   *
   * @description
   * `Edit the list` or `Edit the sprint` of the list menu (`App.dc.html` line 7310):
   * opens the list dialog, which the sidebar hosts, as the header does.
   *
   * @param {TaskList} list - The open list.
   */
  protected editList(list: TaskList): void {
    this.navigation.openDialog({
      kind: 'list',
      spaceId: list.spaceId,
      list,
      sprint: list.sprint !== null,
    });
  }

  /**
   * Method exportCsv
   *
   * @description
   * `Export as CSV` of the list menu: downloads the tasks the view shows, as the header does.
   */
  protected async exportCsv(): Promise<void> {
    const file: ListExport | null = await this.store.exportCsv(this.view.taskQuery());
    if (this.destroyRef.destroyed) return;
    if (!file || !saveTextFile(this.document, file.fileName, file.content)) {
      this.toasts.error($localize`:@@spaces.list.export-failed:Export not possible here`);
      return;
    }
    const count: number = csvRecordCount(file.content);
    this.toasts.show($localize`:@@spaces.list.exported:CSV export ready`, {
      description: $localize`:@@spaces.list.exported-text:${count}:count: tasks exported.`,
    });
  }

  /**
   * Method clearSearch
   *
   * @description
   * `Clear the search` of the empty result: empties the search, or the filters and
   * `Milestones` when there is no search, so the button always shows tasks again.
   */
  protected clearSearch(): void {
    if (this.view.search().trim() !== '') {
      this.view.setSearch('');
      return;
    }
    this.view.clearFilters();
    if (this.view.milestonesOnly()) this.view.toggleMilestones();
  }

  /**
   * Method rowPeople
   *
   * @description
   * Resolves the assignees shown on a row.
   *
   * @param {ListRow} row - The row.
   * @returns {readonly Person[]} Its known assignees.
   */
  protected rowPeople(row: ListRow): readonly Person[] {
    return this.writes
      .people()
      .filter((person: Person) => row.task.assigneeIds.includes(person.id));
  }

  /**
   * Method priorityLabel
   *
   * @description
   * Returns the localized priority name.
   *
   * @param {PriorityKey} priority - The priority.
   * @returns {string} Its label.
   */
  protected priorityLabel(priority: PriorityKey): string {
    return PRIORITY_LABELS[priority];
  }

  /**
   * Method addSubtaskLabel
   *
   * @description
   * Names the subtask creation action for its parent.
   *
   * @param {ListRow} row - The parent row.
   * @returns {string} The accessible label.
   */
  protected addSubtaskLabel(row: ListRow): string {
    return $localize`:@@spaces.rows.add-subtask:Add a subtask to ${row.task.key}:key:`;
  }

  /**
   * Method addSubtask
   *
   * @description
   * Opens the parent's detail on its `Subtasks` tab with the new-subtask field focused, as the
   * mockup's `addKidHere` does (`App.dc.html` lines 6291-6294); the subtask is created there.
   *
   * @param {ListRow} row - The parent row.
   */
  protected addSubtask(row: ListRow): void {
    const task: TaskSummary = row.task;
    void this.taskDetail.open(
      task.key,
      { key: task.key, name: task.name, status: row.status, milestone: task.milestone },
      { tab: 'subtasks' },
    );
  }

  /**
   * Method addInGroup
   *
   * @description
   * The trailing row of a group creates in this list with the group's value: its status, its
   * priority or its assignee (nobody for `Unassigned`).
   *
   * @param {string | null} group - The group value.
   */
  protected addInGroup(group: string | null): void {
    const listId: string = this.listId();
    if (group === null) {
      this.taskCreate.open({ listId });
      return;
    }
    switch (this.rows.groupBy()) {
      case 'status':
        this.taskCreate.open({ listId, status: group as StatusKey });
        return;
      case 'priority':
        this.taskCreate.open({ listId, priority: group as PriorityKey });
        return;
      case 'assignee':
        this.taskCreate.open({
          listId,
          assigneeIds: group === NO_ASSIGNEE_GROUP ? [] : [group],
        });
        return;
      default:
        this.taskCreate.open({ listId });
    }
  }

  /**
   * Method create
   *
   * @description
   * `Add a task` of the empty state and `New task` of the list menu: creates in
   * this list.
   */
  protected create(): void {
    this.taskCreate.open({ listId: this.listId() });
  }

  /**
   * Method clearSelection
   *
   * @description
   * Empties the selection.
   */
  protected clearSelection(): void {
    this.tableSelection.set([]);
  }

  /**
   * Method markDone
   *
   * @description
   * `Mark done` of the selection bar: the icons change at once, the rows join `Done`
   * 460 ms later and the selection empties at once.
   */
  protected markDone(): void {
    const tasks: readonly TaskSummary[] = this.selectedTasks();
    this.clearSelection();
    this.writes.markDone(tasks);
  }

  /**
   * Method moveSelection
   *
   * @description
   * `Move to…` of the selection bar.
   *
   * @param {string} listId - The destination.
   */
  protected moveSelection(listId: string): void {
    const tasks: readonly TaskSummary[] = this.selectedTasks();
    if (tasks.every((task: TaskSummary): boolean => task.listId === listId)) return;
    this.clearSelection();
    this.writes.moveTo(tasks, listId, true);
  }

  /**
   * Method delegateRowMenu
   *
   * @description
   * Makes the whole task row open its menu, as the mockup's `role="row"` does (`App.dc.html`
   * line 659): a right click, the Menu key or Shift F10 anywhere in a task row that no row
   * trigger handles (a cell's padding, the selection cell, a focused cell) is handed to the row's
   * `…` trigger, at the pointer or on the button, and the list menu does not open. Elsewhere,
   * and in an editable field, the event goes on. Runs in the capture phase, since
   * `cw-data-table` offers no row-level menu.
   *
   * @param {Event} event - A `contextmenu` or `keydown` event inside the view.
   */
  private delegateRowMenu(event: Event): void {
    if (event.defaultPrevented) return;
    if (
      event instanceof KeyboardEvent &&
      !(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
    ) {
      return;
    }
    const target: EventTarget | null = event.target;
    if (
      !(target instanceof Element) ||
      target.closest('[data-row-menu]') ||
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
    ) {
      return;
    }
    const actions: HTMLElement | null | undefined = target
      .closest('[role="row"]')
      ?.querySelector<HTMLElement>('[data-row-actions]');
    if (!actions) return;
    event.preventDefault();
    actions.dispatchEvent(
      event instanceof KeyboardEvent
        ? new KeyboardEvent('keydown', {
            key: event.key,
            shiftKey: event.shiftKey,
            bubbles: true,
            cancelable: true,
          })
        : new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: event instanceof MouseEvent ? event.clientX : 0,
            clientY: event instanceof MouseEvent ? event.clientY : 0,
          }),
    );
  }
  // #endregion
}
