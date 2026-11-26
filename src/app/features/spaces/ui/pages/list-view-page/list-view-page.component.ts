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
  LOCALE_ID,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type PriorityKey,
  STATUS_CATEGORIES,
  type StatusCategory,
  type StatusKey,
} from '@cadenway/contracts';
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
  CwMenuGroup,
  CwMenuItem,
  CwMenuItemCheckbox,
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
  CANCEL_REASON_LABELS,
  defaultStatusOptions,
  initialsOf,
  isMilestoneStatus,
  MILESTONE_STATUS_HINTS,
  type Person,
  personOf,
  pickableStatuses,
  PRIORITY_LABELS,
  STATUS_CATEGORY_LABELS,
  STATUS_HINTS,
  statusLabel,
  type StatusOption,
  type TaskBulkAction,
  type TaskBulkEntry,
  type TaskBulkOutcome,
  type TaskBulkSelection,
  TaskCancelDialog,
  type TaskCancellation,
  TaskCreate,
  TaskDetailOpener,
  TaskDueDate,
  TaskLabelChips,
  type TaskStatusChangesInstance,
  TaskStatusChangesStore,
  type TaskSummary,
  TaskTitleCell,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import {
  bulkDeletedText,
  bulkDoneText,
  bulkMovedText,
  bulkPartialText,
  bulkUpdatedText,
  undoConflictText,
  undoConflictTitle,
} from '../../../constants/bulk-copy/bulk-copy.constants';
import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import { groupLabels, sortLabels } from '../../../constants/view-labels/view-labels.constants';
import type { ListExport } from '../../../data-access/services/lists-api/lists-api.service';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type {
  ConfirmedTask,
  ListActOutcome,
  ListRow,
  ListRowsQuery,
} from '../../../models/list-rows/list-rows.interface';
import type {
  ListGroupBy,
  ListSortField,
} from '../../../models/list-view-config/list-view-config.interface';
import type { Space, SpaceStatusOption } from '../../../models/space/space.interface';
import type {
  ListSummary,
  SpaceOverview,
  TaskList,
} from '../../../models/task-list/task-list.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListRowsStore } from '../../../state/list-rows/list-rows.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { saveTextFile } from '../../../utils/file-download/file-download.util';
import { NO_ASSIGNEE_GROUP } from '../../../utils/list-rows/list-rows.util';
import { listIconName, lookTone } from '../../../utils/look/look.util';
import {
  BulkBar,
  type BulkPerson,
  type MoveTarget,
} from '../../components/bulk-bar/bulk-bar.component';

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
 * Constant PRIORITY_ORDER
 *
 * @description
 * The four priorities of the row menu, from the most urgent.
 *
 * @type {readonly PriorityKey[]}
 */
const PRIORITY_ORDER: readonly PriorityKey[] = ['urgente', 'haute', 'moyenne', 'basse'];

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
 * Constant REMINDER_HOUR
 *
 * @description
 * Hour of `Remind me tomorrow morning`, in the caller's time zone (`REM_PRESETS` of `App.dc.html`).
 *
 * @type {number}
 */
const REMINDER_HOUR: number = 9;

/**
 * Interface StatusMenuGroup
 *
 * @description
 * The statuses of one category of the row menu's `Status`, under its heading, each with its
 * hint; a milestone's menu has one group without a heading.
 */
interface StatusMenuGroup {
  // #region Properties
  /**
   * Property category
   *
   * @description
   * Category of the statuses, or null for a milestone's single group.
   *
   * @type {StatusCategory | null}
   * @readonly
   */
  readonly category: StatusCategory | null;

  /**
   * Property heading
   *
   * @description
   * `Not started`, `Active` or `Closed`; empty for a milestone.
   *
   * @type {string}
   * @readonly
   */
  readonly heading: string;

  /**
   * Property entries
   *
   * @description
   * The statuses with their hint, in workflow order.
   *
   * @type {readonly { option: StatusOption; hint: string }[]}
   * @readonly
   */
  readonly entries: readonly { readonly option: StatusOption; readonly hint: string }[];
  // #endregion
}

/**
 * Interface ActionToast
 *
 * @description
 * The toast of an applied action and what its `Undo` sends back.
 */
interface ActionToast {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * Title of the toast.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property description
   *
   * @description
   * Second line of the toast.
   *
   * @type {string}
   * @readonly
   */
  readonly description: string;

  /**
   * Property undo
   *
   * @description
   * Puts back what the action changed, or null when it cannot be undone.
   *
   * @type {(() => void) | null}
   * @readonly
   */
  readonly undo: (() => void) | null;
  // #endregion
}

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
 * Function groupBy
 *
 * @description
 * Splits tasks by a key, in order of first appearance.
 *
 * @param {readonly T[]} items - The items.
 * @param {(item: T) => string} keyOf - The key of an item.
 * @returns {readonly T[][]} The groups.
 */
function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): readonly T[][] {
  const groups: Map<string, T[]> = new Map<string, T[]>();
  for (const item of items) {
    const key: string = keyOf(item);
    const group: T[] | undefined = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.values()];
}

/**
 * Interface ReverseWrite
 *
 * @description
 * One write of an `Undo`: tasks that get the same values back.
 */
interface ReverseWrite {
  // #region Properties
  /**
   * Property tasks
   *
   * @description
   * The tasks as confirmed before the undone action.
   *
   * @type {readonly ConfirmedTask[]}
   * @readonly
   */
  readonly tasks: readonly ConfirmedTask[];

  /**
   * Property action
   *
   * @description
   * The write that puts their values back.
   *
   * @type {TaskBulkAction}
   * @readonly
   */
  readonly action: TaskBulkAction;
  // #endregion
}

/**
 * Function confirmedOf
 *
 * @description
 * The tasks an action applied to, as confirmed before it: what its `Undo` puts back.
 *
 * @param {ListActOutcome} outcome - What the action ended with.
 * @returns {readonly ConfirmedTask[]} The applied tasks, in the order of the outcome.
 */
function confirmedOf(outcome: ListActOutcome): readonly ConfirmedTask[] {
  return outcome.done.flatMap((entry: TaskBulkEntry): ConfirmedTask[] => {
    const task: ConfirmedTask | undefined = outcome.before[entry.taskKey];
    return task ? [task] : [];
  });
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
 * bar. Every write goes through `ListRowsStore.act`: the rows change at once, a refusal puts them
 * back, and the toast's `Undo` sends the reverse write of the values confirmed before the action
 * (a deletion restores the trash entries), reported like the action; leaving the view dismisses
 * those toasts. Under 768 px the rows keep the name and the due date. A failed first read reaches the
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
    CwMenuGroup,
    CwMenuItem,
    CwMenuItemCheckbox,
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
    TaskTitleCell,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
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
   * Property priorities
   *
   * @description
   * The priorities of the row menu, from the most urgent.
   *
   * @type {readonly PriorityKey[]}
   * @readonly
   */
  protected readonly priorities: readonly PriorityKey[] = PRIORITY_ORDER;

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
   * Property workspace
   *
   * @description
   * The committed organization and the signed-in member.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

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
   * Property locale
   *
   * @description
   * Locale of the reminder date.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

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
   * Property undoToasts
   *
   * @description
   * Ids of the shown toasts whose `Undo` writes through this view's rows; leaving the view
   * dismisses them, as leaving it ends the status toasts of `TaskStatusChangesStore`.
   *
   * @type {Set<string>}
   * @readonly
   */
  private readonly undoToasts: Set<string> = new Set<string>();

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
   * Property pending
   *
   * @description
   * Whether a deletion is being recorded (its confirmation shows it).
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly pending: WritableSignal<boolean> = signal(false);

  /**
   * Property confirmDelete
   *
   * @description
   * Whether the deletion of `deleteTasks` is being confirmed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly confirmDelete: WritableSignal<boolean> = signal(false);

  /**
   * Property deleteTasks
   *
   * @description
   * The tasks the confirmation deletes, and whether the row menu asked (its wording names the
   * task) rather than the selection bar.
   *
   * @type {WritableSignal<{ tasks: readonly TaskSummary[]; menu: boolean }>}
   * @readonly
   */
  protected readonly deleteTasks: WritableSignal<{
    tasks: readonly TaskSummary[];
    menu: boolean;
  }> = signal({ tasks: [], menu: false });

  /**
   * Property bulkCancelTasks
   *
   * @description
   * Tasks awaiting a shared cancellation reason, those not cancelled already.
   *
   * @type {WritableSignal<readonly TaskSummary[] | null>}
   * @readonly
   */
  protected readonly bulkCancelTasks: WritableSignal<readonly TaskSummary[] | null> = signal(null);

  /**
   * Property bulkCancelKeys
   *
   * @description
   * Keys named by the cancellation dialog.
   *
   * @type {Signal<readonly string[] | null>}
   * @readonly
   */
  protected readonly bulkCancelKeys: Signal<readonly string[] | null> = computed(
    () => this.bulkCancelTasks()?.map((task: TaskSummary) => task.key) ?? null,
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
   * Property menuTitle
   *
   * @description
   * Heading of the row menu: `CAD-482 · name` or `n tasks selected`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly menuTitle: Signal<string> = computed((): string => {
    const tasks: readonly TaskSummary[] = this.menuTasks();
    const count: number = tasks.length;
    if (count > 1) return $localize`:@@spaces.rows.menu-many:${count}:count: tasks selected`;
    return count === 1 ? `${tasks[0].key} · ${tasks[0].name}` : '';
  });

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
      this.menuTasks().map((task: TaskSummary) => this.shownStatus(task)),
    );
    return statuses.size === 1 ? [...statuses][0] : null;
  });

  /**
   * Property menuPriority
   *
   * @description
   * The priority every task of the menu has, or null when they differ.
   *
   * @type {Signal<PriorityKey | null>}
   * @readonly
   */
  protected readonly menuPriority: Signal<PriorityKey | null> = computed((): PriorityKey | null => {
    const priorities: Set<PriorityKey> = new Set<PriorityKey>(
      this.menuTasks().map((task: TaskSummary) => task.priority),
    );
    return priorities.size === 1 ? [...priorities][0] : null;
  });

  /**
   * Property statusOptions
   *
   * @description
   * The statuses of the list's space: its names, its hidden statuses; the default words until the
   * space is read.
   *
   * @type {Signal<readonly StatusOption[]>}
   * @readonly
   */
  protected readonly statusOptions: Signal<readonly StatusOption[]> = computed(
    (): readonly StatusOption[] => {
      const space: Space | null = this.store.space.hasValue() ? this.store.space.value() : null;
      return defaultStatusOptions().map((option: StatusOption): StatusOption => {
        const own: SpaceStatusOption | undefined = space?.statuses.find(
          (status: SpaceStatusOption): boolean => status.key === option.key,
        );
        return own ? { ...option, label: own.name ?? option.label, hidden: own.hidden } : option;
      });
    },
  );

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
   * Property menuStatusGroups
   *
   * @description
   * `Status` of the row menu: the statuses under `Not started`, `Active` and `Closed`, each
   * with its hint (`App.dc.html` near line 3406); a milestone's four in one group.
   *
   * @type {Signal<readonly StatusMenuGroup[]>}
   * @readonly
   */
  protected readonly menuStatusGroups: Signal<readonly StatusMenuGroup[]> = computed(
    (): readonly StatusMenuGroup[] => {
      const milestone: boolean = this.menuMilestone();
      const entries: { option: StatusOption; hint: string }[] = pickableStatuses(
        this.statusOptions(),
        this.menuStatus() ?? 'todo',
        milestone,
      ).map((option: StatusOption) => ({
        option,
        hint:
          milestone && isMilestoneStatus(option.key)
            ? MILESTONE_STATUS_HINTS[option.key]
            : STATUS_HINTS[option.key],
      }));
      if (milestone) return [{ category: null, heading: '', entries }];
      return STATUS_CATEGORIES.map((category: StatusCategory): StatusMenuGroup => ({
        category,
        heading: STATUS_CATEGORY_LABELS[category],
        entries: entries.filter((entry) => entry.option.category === category),
      })).filter((group: StatusMenuGroup) => group.entries.length > 0);
    },
  );

  /**
   * Property people
   *
   * @description
   * The members the assignees are chosen among, the signed-in member first.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  protected readonly people: Signal<readonly Person[]> = computed((): readonly Person[] => {
    if (!this.store.organizationMembers.hasValue()) return [];
    const me: string = this.workspace.user().id;
    return this.store.organizationMembers
      .value()
      .filter((member: ListMember): boolean => member.name !== null)
      .map((member: ListMember): Person => personOf(member.userId, member.name ?? ''))
      .sort((a: Person, b: Person): number => Number(b.id === me) - Number(a.id === me));
  });

  /**
   * Property userId
   *
   * @description
   * The signed-in member, shown `(me)` in the row menu.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly userId: Signal<string> = computed((): string => this.workspace.user().id);

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
      return this.people().map((person: Person): BulkPerson => ({
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
   * Property targets
   *
   * @description
   * The other lists of the sidebar, with their icon, their tone and their space.
   *
   * @type {Signal<readonly MoveTarget[]>}
   * @readonly
   */
  protected readonly targets: Signal<readonly MoveTarget[]> = computed(
    (): readonly MoveTarget[] => {
      if (!this.navigation.spaces.hasValue() || !this.navigation.overviews.hasValue()) return [];
      const overviews: Readonly<Record<string, SpaceOverview>> = this.navigation.overviews.value();
      const current: string | null = this.store.listId();
      return this.navigation.spaces.value().flatMap((space: Space): MoveTarget[] =>
        space.id in overviews
          ? overviews[space.id].lists
              .filter((summary: ListSummary): boolean => summary.list.id !== current)
              .map((summary: ListSummary): MoveTarget => ({
                listId: summary.list.id,
                name: summary.list.name,
                spaceName: space.name,
                icon: listIconName(summary.list),
                tone:
                  summary.list.color === 'gris'
                    ? 'text-muted-foreground'
                    : lookTone(summary.list.color),
              }))
          : [],
      );
    },
  );

  /**
   * Property menuTargets
   *
   * @description
   * `Move to` of the row menu: the lists not every task of the menu already sits in.
   *
   * @type {Signal<readonly MoveTarget[]>}
   * @readonly
   */
  protected readonly menuTargets: Signal<readonly MoveTarget[]> = computed(
    (): readonly MoveTarget[] => {
      const tasks: readonly TaskSummary[] = this.menuTasks();
      return this.targets().filter(
        (target: MoveTarget): boolean =>
          !tasks.every((task: TaskSummary): boolean => task.listId === target.listId),
      );
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
          this.statusOptions().find((option: StatusOption): boolean => option.key === key)?.label ??
          key
        );
      case 'priority':
        return PRIORITY_LABELS[key as PriorityKey];
      case 'assignee':
        return key === NO_ASSIGNEE_GROUP
          ? $localize`:@@spaces.rows.unassigned:Unassigned`
          : (this.people().find((person: Person): boolean => person.id === key)?.name ?? key);
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
          this.statusOptions().some((option) => option.key === value && option.hidden);
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
        this.statusOptions()
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
      for (const id of this.undoToasts) this.toasts.dismiss(id);
      this.undoToasts.clear();
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
    const person: Person | undefined = this.people().find((item: Person) => item.id === key);
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
   * Method personLabel
   *
   * @description
   * A person of the row menu's `Assign`: the signed-in member reads `Name (me)`.
   *
   * @param {Person} person - The person.
   * @returns {string} The label.
   */
  protected personLabel(person: Person): string {
    const name: string = person.name;
    return person.id === this.userId()
      ? $localize`:@@spaces.rows.assign-me:${name}:name: (me)`
      : name;
  }

  /**
   * Method assignedToAll
   *
   * @description
   * Whether every task of the row menu has the person.
   *
   * @param {string} userId - The person.
   * @returns {boolean} Whether all have it.
   */
  protected assignedToAll(userId: string): boolean {
    const tasks: readonly TaskSummary[] = this.menuTasks();
    return (
      tasks.length > 0 &&
      tasks.every((task: TaskSummary): boolean => task.assigneeIds.includes(userId))
    );
  }

  /**
   * Method remindLabel
   *
   * @description
   * `Remind me tomorrow morning`, or `Remind me of these tasks tomorrow morning` for several.
   *
   * @returns {string} The label.
   */
  protected remindLabel(): string {
    return this.menuTasks().length > 1
      ? $localize`:@@spaces.rows.remind-many:Remind me of these tasks tomorrow morning`
      : $localize`:@@spaces.rows.remind:Remind me tomorrow morning`;
  }

  /**
   * Method deleteMenuLabel
   *
   * @description
   * `Delete the task`, or `Delete the N tasks` for several.
   *
   * @returns {string} The label.
   */
  protected deleteMenuLabel(): string {
    const count: number = this.menuTasks().length;
    return count > 1
      ? $localize`:@@spaces.rows.delete-many:Delete the ${count}:count: tasks`
      : $localize`:@@spaces.bulk.delete-action-one:Delete the task`;
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
   * Method setStatus
   *
   * @description
   * `Status` of the row menu: sets the status of its tasks at once. `Cancelled` asks the reason
   * first, for the tasks not cancelled already, and only when there is one.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks of the menu.
   * @param {StatusKey} status - The status.
   */
  protected setStatus(tasks: readonly TaskSummary[], status: StatusKey): void {
    if (status === 'cancelled') {
      const open: readonly TaskSummary[] = tasks.filter(
        (task: TaskSummary): boolean => this.shownStatus(task) !== 'cancelled',
      );
      if (open.length > 0) this.bulkCancelTasks.set(open);
      return;
    }
    const changed: readonly TaskSummary[] = tasks.filter(
      (task: TaskSummary): boolean => this.shownStatus(task) !== status,
    );
    if (changed.length === 0) return;
    const word: string = statusLabel(status, this.statusOptions(), this.menuMilestone());
    const label: string = this.tasksLabel(tasks);
    void this.perform(
      changed,
      { type: 'status', status },
      (done: readonly TaskBulkEntry[], outcome: ListActOutcome) => ({
        title: $localize`:@@spaces.rows.status-toast:${label}:label: · ${word}:status:`,
        description:
          tasks.length > 1
            ? bulkUpdatedText(done.length)
            : $localize`:@@spaces.rows.status-changed:Status changed.`,
        undo: (): void => {
          this.undoStatuses(outcome);
        },
      }),
    );
  }

  /**
   * Method confirmBulkCancel
   *
   * @description
   * Cancels the tasks of the dialog with their shared reason; the toast names the reason and
   * offers `Undo`.
   *
   * @param {TaskCancellation} cancellation - The reason and optional note.
   */
  protected confirmBulkCancel(cancellation: TaskCancellation): void {
    const tasks: readonly TaskSummary[] = this.bulkCancelTasks() ?? [];
    this.bulkCancelTasks.set(null);
    if (tasks.length === 0) return;
    const reason: string = CANCEL_REASON_LABELS[cancellation.reason];
    void this.perform(
      tasks,
      {
        type: 'status',
        status: 'cancelled',
        cancelReason: cancellation.reason,
        cancelNote: cancellation.note || null,
      },
      (done: readonly TaskBulkEntry[], outcome: ListActOutcome) => {
        const count: number = done.length;
        const key: string = done[0]?.taskKey ?? '';
        return {
          title:
            count > 1
              ? $localize`:@@spaces.rows.cancelled-many:${count}:count: tasks cancelled`
              : $localize`:@@spaces.rows.cancelled-one:${key}:key: cancelled`,
          description: $localize`:@@spaces.rows.cancel-reason:Reason: ${reason}:reason:.`,
          undo: (): void => {
            this.undoStatuses(outcome);
          },
        };
      },
    );
  }

  /**
   * Method setPriority
   *
   * @description
   * `Priority` of the row menu.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks of the menu.
   * @param {PriorityKey} priority - The priority.
   */
  protected setPriority(tasks: readonly TaskSummary[], priority: PriorityKey): void {
    const changed: readonly TaskSummary[] = tasks.filter(
      (task: TaskSummary): boolean => task.priority !== priority,
    );
    if (changed.length === 0) return;
    const label: string = this.tasksLabel(tasks);
    const word: string = PRIORITY_LABELS[priority].toLocaleLowerCase(this.locale);
    void this.perform(
      changed,
      { type: 'priority', priority },
      (done: readonly TaskBulkEntry[], outcome: ListActOutcome) => ({
        title: $localize`:@@spaces.rows.priority-toast:${label}:label: · ${word}:priority: priority`,
        description:
          tasks.length > 1
            ? bulkUpdatedText(done.length)
            : $localize`:@@spaces.rows.priority-changed:Priority changed.`,
        undo: (): void => {
          void this.reverse(
            groupBy(confirmedOf(outcome), (task: ConfirmedTask) => task.priority).map(
              (group: readonly ConfirmedTask[]): ReverseWrite => ({
                tasks: group,
                action: { type: 'priority', priority: group[0].priority },
              }),
            ),
            outcome.after,
          );
        },
      }),
    );
  }

  /**
   * Method toggleAssignee
   *
   * @description
   * `Assign` of the row menu or of the selection bar: assigns the person to every task, or
   * removes the person when every task has them already.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @param {string} userId - The person.
   * @param {boolean} [bar] - Whether the selection bar asked (its toast counts the tasks).
   */
  protected toggleAssignee(
    tasks: readonly TaskSummary[],
    userId: string,
    bar: boolean = false,
  ): void {
    if (tasks.length === 0) return;
    const name: string =
      this.people().find((person: Person): boolean => person.id === userId)?.name ?? '';
    const all: boolean = tasks.every((task: TaskSummary): boolean =>
      task.assigneeIds.includes(userId),
    );
    const changed: readonly TaskSummary[] = all
      ? tasks
      : tasks.filter((task: TaskSummary): boolean => !task.assigneeIds.includes(userId));
    const label: string = this.tasksLabel(tasks);
    void this.perform(
      changed,
      { type: all ? 'unassign' : 'assign', userId },
      (done: readonly TaskBulkEntry[], outcome: ListActOutcome) => ({
        title: all
          ? $localize`:@@spaces.bulk.unassigned:${name}:name: removed`
          : $localize`:@@spaces.bulk.assigned:${name}:name: assigned`,
        description: bar ? bulkUpdatedText(done.length) : label,
        undo: (): void => {
          void this.reverse(
            [
              {
                tasks: confirmedOf(outcome),
                action: { type: all ? 'assign' : 'unassign', userId },
              },
            ],
            outcome.after,
          );
        },
      }),
    );
  }

  /**
   * Method moveTo
   *
   * @description
   * `Move to` of the row menu or of the selection bar; the rows leave the view at once.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @param {string} listId - The destination.
   * @param {boolean} [bar] - Whether the selection bar asked, which clears the selection.
   */
  protected moveTo(tasks: readonly TaskSummary[], listId: string, bar: boolean = false): void {
    const moved: readonly TaskSummary[] = tasks.filter(
      (task: TaskSummary): boolean => task.listId !== listId,
    );
    if (moved.length === 0) return;
    if (bar) this.clearSelection();
    const name: string =
      this.targets().find((target: MoveTarget): boolean => target.listId === listId)?.name ?? '';
    const key: string = moved[0].key;
    void this.perform(
      moved,
      { type: 'move', listId },
      (done: readonly TaskBulkEntry[], outcome: ListActOutcome) => ({
        title:
          bar || tasks.length > 1
            ? bulkMovedText(done.length)
            : $localize`:@@spaces.rows.moved-one:${key}:key: moved`,
        description: $localize`:@@spaces.bulk.moved-text:To ${name}:name:.`,
        undo: (): void => {
          void this.reverse(
            groupBy(confirmedOf(outcome), (task: ConfirmedTask) => task.listId).map(
              (group: readonly ConfirmedTask[]): ReverseWrite => ({
                tasks: group,
                action: { type: 'move', listId: group[0].listId },
              }),
            ),
            outcome.after,
          );
        },
      }),
    );
  }

  /**
   * Method remind
   *
   * @description
   * `Remind me tomorrow morning`: a reminder tomorrow at 9 for each task of the menu.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   */
  protected async remind(tasks: readonly TaskSummary[]): Promise<void> {
    const at: Date = new Date();
    at.setDate(at.getDate() + 1);
    at.setHours(REMINDER_HOUR, 0, 0, 0);
    const keys: readonly string[] = await this.rows.remind(
      tasks.map((task: TaskSummary): string => task.key),
      at,
    );
    if (this.destroyRef.destroyed) return;
    if (keys.length === 0) {
      this.toasts.error($localize`:@@spaces.rows.remind-failed:The reminder could not be set`);
      return;
    }
    const day: string = new Intl.DateTimeFormat(this.locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(at);
    const when: string = `${day.charAt(0).toLocaleUpperCase(this.locale)}${day.slice(1)}`;
    const count: number = keys.length;
    this.toasts.show(
      count > 1
        ? $localize`:@@spaces.rows.reminded-many:${count}:count: reminders set`
        : $localize`:@@spaces.rows.reminded:Reminder set`,
      {
        description: $localize`:@@spaces.rows.reminded-text:${when}:date:, 9 AM · ${keys.join(', ')}:keys:`,
      },
    );
  }

  /**
   * Method duplicate
   *
   * @description
   * `Duplicate`: copies each task of the menu; the toast names the copies and `Open` opens
   * a single copy.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   */
  protected duplicate(tasks: readonly TaskSummary[]): void {
    void this.perform(tasks, { type: 'duplicate' }, (done: readonly TaskBulkEntry[]) => {
      const copies: readonly string[] = done
        .map((entry: TaskBulkEntry) => entry.newTaskKey)
        .filter((key: string | null): key is string => key !== null);
      const count: number = copies.length;
      return {
        title:
          tasks.length > 1
            ? $localize`:@@spaces.rows.duplicated-many:${count}:count: tasks duplicated`
            : $localize`:@@spaces.rows.duplicated:Task duplicated`,
        description: copies.join(', '),
        undo: null,
        open: count === 1 ? copies[0] : null,
      };
    });
  }

  /**
   * Method copyLinks
   *
   * @description
   * `Copy the link`: the shareable addresses of the tasks (`/<slug>/t/<KEY>`), one per line.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   */
  protected copyLinks(tasks: readonly TaskSummary[]): void {
    const origin: string = this.document.defaultView?.location.origin ?? '';
    const slug: string = this.workspace.organization().slug;
    const count: number = tasks.length;
    void this.copy(
      tasks.map((task: TaskSummary): string => `${origin}/${slug}/t/${task.key}`).join('\n'),
      count > 1
        ? $localize`:@@spaces.rows.links-copied:${count}:count: links copied`
        : $localize`:@@spaces.rows.link-copied:Link copied`,
    );
  }

  /**
   * Method copyKeys
   *
   * @description
   * `Copy the identifier`: the keys of the tasks, comma-separated.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   */
  protected copyKeys(tasks: readonly TaskSummary[]): void {
    void this.copy(
      tasks.map((task: TaskSummary): string => task.key).join(', '),
      tasks.length > 1
        ? $localize`:@@spaces.rows.keys-copied:Identifiers copied`
        : $localize`:@@spaces.rows.key-copied:Identifier copied`,
    );
  }

  /**
   * Method askDelete
   *
   * @description
   * Opens the deletion confirmation of the row menu or of the selection bar.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @param {boolean} menu - Whether the row menu asked.
   */
  protected askDelete(tasks: readonly TaskSummary[], menu: boolean): void {
    if (tasks.length === 0) return;
    this.deleteTasks.set({ tasks, menu });
    this.confirmDelete.set(true);
  }

  /**
   * Method trash
   *
   * @description
   * Moves the confirmed tasks to the trash; the toast counts their subtasks and `Undo`
   * restores the trash entries.
   */
  protected async trash(): Promise<void> {
    const { tasks, menu }: { tasks: readonly TaskSummary[]; menu: boolean } = this.deleteTasks();
    if (tasks.length === 0 || this.pending()) return;
    this.pending.set(true);
    const key: string = tasks[0].key;
    await this.perform(
      tasks,
      { type: 'trash' },
      (done: readonly TaskBulkEntry[], outcome: ListActOutcome) => {
        const count: number = done.length;
        const subtasks: number = Math.max(0, outcome.affected - count);
        const kept: string = $localize`:@@spaces.bulk.deleted-text:Kept 30 days in the trash.`;
        const entries: readonly string[] = [
          ...new Set(
            done
              .map((entry: TaskBulkEntry) => entry.trashEntryId)
              .filter((id: string | null): id is string => id !== null),
          ),
        ];
        return {
          title:
            menu && tasks.length === 1
              ? $localize`:@@spaces.rows.deleted-one:${key}:key: deleted`
              : bulkDeletedText(count),
          description:
            subtasks === 0
              ? kept
              : subtasks === 1
                ? $localize`:@@spaces.bulk.deleted-subtask:With ${subtasks}:count: subtask. ${kept}:kept:`
                : $localize`:@@spaces.bulk.deleted-subtasks:With ${subtasks}:count: subtasks. ${kept}:kept:`,
          undo:
            entries.length > 0
              ? (): void => {
                  void this.restore(entries);
                }
              : null,
        };
      },
    );
    if (this.destroyRef.destroyed) return;
    this.pending.set(false);
    this.confirmDelete.set(false);
  }

  /**
   * Method deleteTitle
   *
   * @description
   * Question of the deletion: `Delete “name”?` from the row menu, else `Delete this task?`;
   * `Delete N tasks?` for several.
   *
   * @returns {string} The title.
   */
  protected deleteTitle(): string {
    const { tasks, menu }: { tasks: readonly TaskSummary[]; menu: boolean } = this.deleteTasks();
    const count: number = tasks.length;
    if (count > 1) return $localize`:@@spaces.bulk.delete-title:Delete ${count}:count: tasks?`;
    const name: string = tasks[0]?.name ?? '';
    return menu
      ? $localize`:@@spaces.rows.delete-title:Delete “${name}:name:”?`
      : $localize`:@@spaces.bulk.delete-title-one:Delete this task?`;
  }

  /**
   * Method deleteText
   *
   * @description
   * What the deletion does, in the wording of its origin.
   *
   * @returns {string} The text.
   */
  protected deleteText(): string {
    const { tasks, menu }: { tasks: readonly TaskSummary[]; menu: boolean } = this.deleteTasks();
    if (!menu) {
      return $localize`:@@spaces.bulk.delete-text:The selected tasks go to the trash with their subtasks, where they stay 30 days.`;
    }
    return tasks.length > 1
      ? $localize`:@@spaces.rows.delete-text-many:They go to the trash with their subtasks, where they stay 30 days.`
      : $localize`:@@spaces.rows.delete-text-one:It goes to the trash with its subtasks, where it stays 30 days.`;
  }

  /**
   * Method deleteAction
   *
   * @description
   * Action of the deletion.
   *
   * @returns {string} The label.
   */
  protected deleteAction(): string {
    const count: number = this.deleteTasks().tasks.length;
    return count > 1
      ? $localize`:@@spaces.bulk.delete-action:Delete ${count}:count: tasks`
      : $localize`:@@spaces.bulk.delete-action-one:Delete the task`;
  }

  /**
   * Method deleteItems
   *
   * @description
   * The tasks the confirmation lists (`CAD-482 · name`).
   *
   * @returns {readonly string[]} The items.
   */
  protected deleteItems(): readonly string[] {
    return this.deleteTasks().tasks.map(
      (task: TaskSummary): string => `${task.key} · ${task.name}`,
    );
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
    return this.people().filter((person: Person) => row.task.assigneeIds.includes(person.id));
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
    const tasks: readonly TaskSummary[] = this.selectedTasks().filter(
      (task: TaskSummary): boolean => this.shownStatus(task) !== 'done',
    );
    this.clearSelection();
    if (tasks.length === 0) return;
    void this.perform(
      tasks,
      { type: 'status', status: 'done' },
      (done: readonly TaskBulkEntry[], outcome: ListActOutcome) => ({
        title: bulkDoneText(done.length),
        description: $localize`:@@spaces.bulk.done-toast-text:Status: Done.`,
        undo: (): void => {
          this.undoStatuses(outcome);
        },
      }),
    );
  }

  /**
   * Method assignSelection
   *
   * @description
   * `Assign` of the selection bar.
   *
   * @param {string} userId - The person.
   */
  protected assignSelection(userId: string): void {
    this.toggleAssignee(this.selectedTasks(), userId, true);
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
    this.moveTo(this.selectedTasks(), listId, true);
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

  /**
   * Method shownStatus
   *
   * @description
   * The status a task shows in the view, a pending change or an optimistic write included.
   *
   * @param {TaskSummary} task - The task.
   * @returns {StatusKey} The status.
   */
  private shownStatus(task: TaskSummary): StatusKey {
    return (
      this.rows.rows().find((row: ListRow): boolean => row.task.key === task.key)?.status ??
      this.statusChanges.displayedStatus(task)
    );
  }

  /**
   * Method tasksLabel
   *
   * @description
   * How a toast names the tasks: `CAD-482` or `3 tasks`.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @returns {string} The label.
   */
  private tasksLabel(tasks: readonly TaskSummary[]): string {
    const count: number = tasks.length;
    return count > 1
      ? $localize`:@@spaces.rows.count-many:${count}:count: tasks`
      : (tasks[0]?.key ?? '');
  }

  /**
   * Method perform
   *
   * @description
   * Applies an action through `ListRowsStore.act`, then reports it. Tasks of a refused chunk stay
   * selected and a second toast counts them; a refusal of everything shows the failure toast; an
   * uncertain answer warns and the rows are read again. The success toast offers `Undo` when
   * the action can be undone, or `Open` for a single copy. The list's counts are read again.
   * An action answered after the view was left reports only what failed: no `Undo` is offered
   * once the view is gone. An action a newer status change replaced reports nothing.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks, as shown.
   * @param {TaskBulkAction} action - The action.
   * @param {(done: readonly TaskBulkEntry[], outcome: ListActOutcome) => ActionToast & { open?: string | null }} toast - The success toast.
   * @returns {Promise<void>} Resolves once reported.
   */
  private async perform(
    tasks: readonly TaskSummary[],
    action: TaskBulkAction,
    toast: (
      done: readonly TaskBulkEntry[],
      outcome: ListActOutcome,
    ) => ActionToast & { readonly open?: string | null },
  ): Promise<void> {
    if (tasks.length === 0) return;
    const organizationId: string = this.workspace.organization().id;
    const outcome: ListActOutcome = await this.rows.act(tasks, action);
    if (this.workspace.organization().id !== organizationId) return;
    const live: boolean = !this.destroyRef.destroyed;
    if (live && (outcome.done.length > 0 || outcome.unknown.length > 0)) {
      this.store.refreshCounts();
    }
    if (!this.reportProblems(outcome)) return;
    const failedKeys: readonly string[] = outcome.failed.map(
      (item: TaskBulkSelection): string => item.taskKey,
    );
    if (live && failedKeys.length > 0) {
      this.tableSelection.set(
        this.rows
          .rows()
          .filter((row: ListRow): boolean => failedKeys.includes(row.task.key))
          .map((row: ListRow): string => row.id),
      );
    }
    if (live) {
      const message: ActionToast & { readonly open?: string | null } = toast(outcome.done, outcome);
      const copy: string | null = message.open ?? null;
      const id: string = this.toasts.show(message.title, {
        description: message.description,
        ...(copy
          ? {
              action: {
                label: $localize`:@@spaces.rows.open:Open`,
                run: (): void => {
                  this.open(copy);
                },
              },
            }
          : message.undo
            ? { undo: message.undo }
            : {}),
      });
      if (!copy && message.undo) this.keepUndoToast(id);
    }
    if (outcome.failed.length > 0) {
      this.toasts.error(
        bulkPartialText(outcome.failed.length, tasks.length),
        live ? { description: $localize`:@@spaces.bulk.partial-text:They stay selected.` } : {},
      );
    }
  }

  /**
   * Method reportProblems
   *
   * @description
   * Reports the tasks of an action that were not sent, have no certain outcome, or were all
   * refused; resolves whether some task was applied.
   *
   * @param {TaskBulkOutcome} outcome - What the action ended with.
   * @returns {boolean} Whether some task was applied.
   */
  private reportProblems(outcome: TaskBulkOutcome): boolean {
    if (outcome.notSent.length > 0) {
      this.toasts.warning($localize`:@@spaces.bulk.not-sent:Some selected tasks were not sent.`);
    }
    if (outcome.unknown.length > 0) {
      this.toasts.warning(
        $localize`:@@spaces.bulk.unknown:The outcome is unknown. The tasks are being refreshed.`,
      );
    }
    if (outcome.done.length > 0) return true;
    if (outcome.failed.length > 0 && outcome.unknown.length === 0 && outcome.notSent.length === 0) {
      this.toasts.error($localize`:@@spaces.bulk.failed:The selection could not be changed`);
    }
    return false;
  }

  /**
   * Method keepUndoToast
   *
   * @description
   * Remembers a toast whose `Undo` writes through this view, so leaving the view dismisses it,
   * and forgets the toasts already closed.
   *
   * @param {string} id - The toast.
   */
  private keepUndoToast(id: string): void {
    const shown: ReadonlySet<string> = new Set(
      this.toasts.toasts().map((item: { readonly id: string }): string => item.id),
    );
    for (const kept of this.undoToasts) if (!shown.has(kept)) this.undoToasts.delete(kept);
    this.undoToasts.add(id);
  }

  /**
   * Method reverse
   *
   * @description
   * The `Undo` of an action: sends each reverse write with the values confirmed before the
   * action, bound to the version the action left each task at. `ListRowsStore.act` skips a task
   * that changed since (by this view, another view or another person, once read) and sends the
   * others at that version, so a change not read yet makes the gateway refuse them; an `Undo`
   * never writes old values over a newer change. A warning names the skipped tasks. Reports the
   * rest like the action does (tasks not sent, without a certain outcome, refused in part or in
   * full) and reads the rows again after a refusal, even when the view was left meanwhile.
   *
   * @param {readonly ReverseWrite[]} writes - The reverse writes.
   * @param {Readonly<Partial<Record<string, number>>>} after - The version the undone action left
   * each task at.
   * @returns {Promise<void>} Resolves once reported.
   */
  private async reverse(
    writes: readonly ReverseWrite[],
    after: Readonly<Partial<Record<string, number>>>,
  ): Promise<void> {
    const sent: readonly ReverseWrite[] = writes.filter(
      (write: ReverseWrite): boolean => write.tasks.length > 0,
    );
    if (sent.length === 0) return;
    const outcomes: readonly ListActOutcome[] = await Promise.all(
      sent.map((write: ReverseWrite) => this.rows.act(write.tasks, write.action, after)),
    );
    const changed: readonly string[] = outcomes.flatMap((item: ListActOutcome) =>
      item.changed.map((selection: TaskBulkSelection): string => selection.taskKey),
    );
    if (changed.length > 0) {
      this.toasts.warning(undoConflictTitle(changed), {
        description: undoConflictText(changed.length),
      });
    }
    const outcome: TaskBulkOutcome = {
      affected: outcomes.reduce((sum: number, item: ListActOutcome) => sum + item.affected, 0),
      done: outcomes.flatMap((item: ListActOutcome) => item.done),
      failed: outcomes.flatMap((item: ListActOutcome) => item.failed),
      unknown: outcomes.flatMap((item: ListActOutcome) => item.unknown),
      notSent: outcomes.flatMap((item: ListActOutcome) => item.notSent),
    };
    if (!this.destroyRef.destroyed) {
      if (outcome.done.length > 0 || outcome.unknown.length > 0) this.store.refreshCounts();
      if (outcome.failed.length > 0) this.rows.reload();
    }
    const total: number =
      sent.reduce((sum: number, write: ReverseWrite): number => sum + write.tasks.length, 0) -
      changed.length;
    if (this.reportProblems(outcome) && outcome.failed.length > 0) {
      this.toasts.error(bulkPartialText(outcome.failed.length, total));
    }
  }

  /**
   * Method undoStatuses
   *
   * @description
   * Puts back each task's status as confirmed before the change, with its cancellation reason
   * and note when it was cancelled.
   *
   * @param {ListActOutcome} outcome - What the change ended with.
   */
  private undoStatuses(outcome: ListActOutcome): void {
    void this.reverse(
      groupBy(
        confirmedOf(outcome),
        (task: ConfirmedTask) =>
          `${task.status}\u0000${task.cancelReason ?? ''}\u0000${task.cancelNote ?? ''}`,
      ).map((group: readonly ConfirmedTask[]): ReverseWrite => {
        const { status, cancelReason, cancelNote }: ConfirmedTask = group[0];
        return {
          tasks: group,
          action:
            status === 'cancelled' && cancelReason
              ? { type: 'status', status, cancelReason, cancelNote }
              : { type: 'status', status },
        };
      }),
      outcome.after,
    );
  }

  /**
   * Method restore
   *
   * @description
   * `Undo` of a deletion: takes the trash entries back; a refusal is reported even when the view
   * was left meanwhile.
   *
   * @param {readonly string[]} entryIds - The trash entries.
   * @returns {Promise<void>} Resolves once restored.
   */
  private async restore(entryIds: readonly string[]): Promise<void> {
    const restored: boolean = await this.rows.restore(entryIds);
    if (!this.destroyRef.destroyed) this.store.refreshCounts();
    if (!restored) {
      this.toasts.error($localize`:@@spaces.bulk.restore-failed:The tasks could not be restored`);
    }
  }

  /**
   * Method copy
   *
   * @description
   * Writes text to the clipboard and confirms it.
   *
   * @param {string} text - The text.
   * @param {string} title - The confirmation.
   * @returns {Promise<void>} Resolves once copied or refused.
   */
  private async copy(text: string, title: string): Promise<void> {
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(text);
      this.toasts.show(title, { description: text });
    } catch {
      this.toasts.error($localize`:@@spaces.rows.copy-failed:Could not copy`, {
        description: text,
      });
    }
  }
  // #endregion
}
