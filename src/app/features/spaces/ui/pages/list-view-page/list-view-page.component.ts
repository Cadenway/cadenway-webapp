import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
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
import { ActivatedRoute, Router } from '@angular/router';
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

import {
  defaultStatusOptions,
  initialsOf,
  type Person,
  personOf,
  pickableStatuses,
  PRIORITY_LABELS,
  type StatusOption,
  TaskCancelDialog,
  type TaskCancellation,
  TaskCreate,
  TaskDueDate,
  TaskLabelChips,
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
} from '../../../constants/bulk-copy/bulk-copy.constants';
import type {
  BulkAction,
  BulkOutcome,
  BulkSelection,
} from '../../../models/bulk-action/bulk-action.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type { ListRow, ListRowsQuery } from '../../../models/list-rows/list-rows.interface';
import type { Space, SpaceStatusOption } from '../../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../../models/task-list/task-list.interface';
import type { ViewOption } from '../../../models/view-option/view-option.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListRowsStore } from '../../../state/list-rows/list-rows.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { NO_ASSIGNEE_GROUP } from '../../../utils/list-rows/list-rows.util';
import { BulkBar, type MoveTarget } from '../../components/bulk-bar/bulk-bar.component';

/**
 * Component ListViewPage
 *
 * @description
 * The « Liste » view of a list (`/:org/l/:listId/list`): the grouped task rows of `ListRowsStore`
 * in a virtualized `cw-data-table`, read page by page as the table scrolls. A row shows the
 * status and the name (`cw-task-title-cell`), the
 * assignees and the priority, the due date and
 * the labels; its « … » button and its right click open the menu of the task or of the
 * selection, whose « Statut » sets any status (« Annulé » asks its reason first). A click on the
 * name or Enter opens the task (`?task=<KEY>`, the detail comes in step 5). Each group's add row
 * and `N` create in this list. The selection fills the selection bar, whose actions go through
 * `executeBulkTaskAction` in chunks of 50; a refused chunk stays selected and is reported. Under
 * 768 px the rows keep the name and the due date. A failed first read reaches the route's error
 * boundary; a failed next page or subtask read offers « Réessayer » in place.
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
   * The view configuration: query, grouping, subtask display and search.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  protected readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property rows
   *
   * @description
   * The rows of the view.
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
   * @type {InstanceType<typeof TaskStatusChangesStore>}
   * @readonly
   */
  protected readonly statusChanges: InstanceType<typeof TaskStatusChangesStore> =
    inject(TaskStatusChangesStore);

  /**
   * Property navigation
   *
   * @description
   * The workspace's navigation, for the destinations of a move.
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
   * Property router
   *
   * @description
   * Opens a task in the address.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property route
   *
   * @description
   * The view's route, to stay on it when a task opens.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property host
   *
   * @description
   * The page element, which hears the scrolling of the table.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

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
   * Property selection
   *
   * @description
   * The selected tasks with the version they are shown at, for the selection bar.
   *
   * @type {Signal<readonly BulkSelection[]>}
   * @readonly
   */
  protected readonly selection: Signal<readonly BulkSelection[]> = computed(
    (): readonly BulkSelection[] =>
      this.selectedTasks().map((task: TaskSummary): BulkSelection => ({
        taskKey: task.key,
        version: task.version,
      })),
  );

  /**
   * Property pending
   *
   * @description
   * Whether a bulk action is being recorded.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly pending: WritableSignal<boolean> = signal(false);

  /**
   * Property confirmDelete
   *
   * @description
   * Whether the deletion of the selection is being confirmed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly confirmDelete: WritableSignal<boolean> = signal(false);

  /**
   * Property bulkCancelTasks
   *
   * @description
   * Selected tasks awaiting a shared cancellation reason.
   *
   * @type {WritableSignal<readonly TaskSummary[] | null>}
   * @readonly
   */
  protected readonly bulkCancelTasks: WritableSignal<readonly TaskSummary[] | null> = signal(null);

  /**
   * Property bulkCancelKeys
   *
   * @description
   * Keys named by the bulk cancellation dialog.
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
   * Heading of the row menu: « CAD-482 · name » or « n tâches sélectionnées ».
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
      this.menuTasks().map((task: TaskSummary) => this.statusChanges.displayedStatus(task)),
    );
    return statuses.size === 1 ? [...statuses][0] : null;
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
   * Property menuStatuses
   *
   * @description
   * The statuses the row menu offers, a milestone's four when every task is a milestone.
   *
   * @type {Signal<readonly StatusOption[]>}
   * @readonly
   */
  protected readonly menuStatuses: Signal<readonly StatusOption[]> = computed(
    (): readonly StatusOption[] => {
      const tasks: readonly TaskSummary[] = this.menuTasks();
      const milestone: boolean =
        tasks.length > 0 && tasks.every((task: TaskSummary): boolean => task.milestone);
      return pickableStatuses(this.statusOptions(), this.menuStatus() ?? 'todo', milestone);
    },
  );

  /**
   * Property people
   *
   * @description
   * The members the assignees are chosen among.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  protected readonly people: Signal<readonly Person[]> = computed((): readonly Person[] =>
    this.store.organizationMembers.hasValue()
      ? this.store.organizationMembers
          .value()
          .filter((member: ListMember): boolean => member.name !== null)
          .map((member: ListMember): Person => personOf(member.userId, member.name ?? ''))
      : [],
  );

  /**
   * Property userId
   *
   * @description
   * The signed-in member, shown « (moi) » in the people picker.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly userId: Signal<string> = computed((): string => this.workspace.user().id);

  /**
   * Property bulkPeople
   *
   * @description
   * People the selection may be assigned to.
   *
   * @type {Signal<readonly ViewOption[]>}
   * @readonly
   */
  protected readonly bulkPeople: Signal<readonly ViewOption[]> = computed(
    (): readonly ViewOption[] =>
      this.people().map((person: Person): ViewOption => ({ value: person.id, label: person.name })),
  );

  /**
   * Property targets
   *
   * @description
   * The other lists of the sidebar, with their space.
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
              }))
          : [],
      );
    },
  );

  /**
   * Property tableLabel
   *
   * @description
   * Accessible name of the table (« Tâches de la liste Sprint 14 »).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly tableLabel: Signal<string> = computed((): string => {
    const name: string = this.store.list.hasValue() ? this.store.list.value().name : '';
    return $localize`:@@spaces.rows.table:Tasks of the list ${name}:name:`;
  });

  /**
   * Property separate
   *
   * @description
   * Whether subtasks show « À part, comme des tâches », with their parent's key.
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
   * Whether a filter, the search or « Jalons » narrows the rows.
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
   * Short name of a row for its checkbox (« Sélectionner CAD-482 »).
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
   * « Non assignées » or « Toutes les tâches ».
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
   * Property tableGroups
   *
   * @description
   * Visible groups with server counts, including empty default status groups.
   *
   * @type {Signal<readonly CwGroupDef[]>}
   * @readonly
   */
  protected readonly tableGroups: Signal<readonly CwGroupDef[]> = computed(() => {
    const values: readonly string[] = this.rows.groupOrder();
    const visible: readonly string[] =
      this.rows.groupBy() === 'status'
        ? [
            ...new Set([
              ...this.statusOptions()
                .filter(
                  (option) =>
                    !option.hidden &&
                    !['triage', 'backlog', 'testing', 'waiting', 'cancelled'].includes(option.key),
                )
                .map((option) => option.key),
              ...values,
            ]),
          ].filter(
            (value) =>
              !this.statusOptions().some((option) => option.key === value && option.hidden),
          )
        : values;
    return visible.map((value) => ({
      value,
      label: this.groupLabel(value),
      count: this.rows.groupCount(value) ?? (this.rows.groupBy() === null ? undefined : 0),
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
   * space's hidden statuses, makes `N` create in this list while the view lives, and reads the
   * next page when the table nears its end. A first read
   * that failed is read again when the error boundary runs the route again.
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
    this.rows.hideStatuses(
      computed((): readonly string[] =>
        this.statusOptions()
          .filter((option: StatusOption): boolean => option.hidden)
          .map((option: StatusOption): string => option.key),
      ),
    );
    this.taskCreate.useDefaults(() => ({ listId: this.listId() }), this.destroyRef);

    let previousGroups: Map<string, string> = new Map<string, string>();
    let restoreFocus: { key: string; element: Element } | null = null;
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
      previousGroups = new Map(current.map((item: ListRow) => [item.task.key, item.group]));
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
   * Initials of an assignee group (« — » for « Non assignées »).
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
   * Name of the caret of a row's subtasks (« Afficher les 3 sous-tâches de CAD-482 »).
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
   * Name of a row's « … » button (« Actions sur CAD-482 »).
   *
   * @param {ListRow} row - The row.
   * @returns {string} The label.
   */
  protected actionsLabel(row: ListRow): string {
    const key: string = row.task.key;
    return $localize`:@@spaces.rows.actions:Actions on ${key}:key:`;
  }

  /**
   * Method open
   *
   * @description
   * Opens a task in the address (`?task=<KEY>`), keeping the view and its other parameters; the
   * task detail that reads it comes in step 5.
   *
   * @param {TaskSummary} task - The task.
   */
  protected open(task: TaskSummary): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { task: task.key },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method setStatus
   *
   * @description
   * « Statut » of the row menu: sets the status of its tasks; « Annulé » asks the reason first,
   * once for all of them.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks of the menu.
   * @param {StatusKey} status - The status.
   */
  protected setStatus(tasks: readonly TaskSummary[], status: StatusKey): void {
    if (tasks.length === 1) {
      this.statusChanges.request(tasks[0], status, this.statusOptions());
    } else if (tasks.length > 1 && status === 'cancelled') {
      this.bulkCancelTasks.set(tasks);
    } else if (tasks.length > 1) {
      this.bulkStatus(status, tasks);
    }
  }

  /**
   * Method confirmBulkCancel
   *
   * @description
   * Sends the shared cancellation reason to the bulk action.
   *
   * @param {TaskCancellation} cancellation - The reason and optional note.
   */
  protected confirmBulkCancel(cancellation: TaskCancellation): void {
    const tasks: readonly TaskSummary[] = this.bulkCancelTasks() ?? [];
    this.bulkCancelTasks.set(null);
    this.bulkStatus('cancelled', tasks, cancellation);
  }

  /**
   * Method bulkStatus
   *
   * @description
   * Sends one bulk status action for the selection.
   *
   * @param {StatusKey} status - The target status.
   * @param {readonly TaskSummary[]} tasks - Tasks selected when the action was requested.
   * @param {TaskCancellation} [cancellation] - The cancellation reason.
   */
  protected bulkStatus(
    status: StatusKey,
    tasks: readonly TaskSummary[],
    cancellation?: TaskCancellation,
  ): void {
    const label: string =
      this.statusOptions().find((option: StatusOption) => option.key === status)?.label ?? status;
    void this.run(
      {
        type: 'status',
        status,
        ...(cancellation
          ? { cancelReason: cancellation.reason, cancelNote: cancellation.note || null }
          : {}),
      },
      (count: number) => ({
        title: $localize`:@@spaces.bulk.status-toast:${label}:label: · Status`,
        description: bulkUpdatedText(count),
      }),
      tasks.map((task: TaskSummary) => ({ taskKey: task.key, version: task.version })),
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
   * Opens creation with the parent and destination list.
   *
   * @param {ListRow} row - The parent row.
   */
  protected addSubtask(row: ListRow): void {
    this.taskCreate.open({ parentKey: row.task.key, listId: row.task.listId });
  }

  /**
   * Method addInGroup
   *
   * @description
   * The trailing row of a group creates in this list, with the group's status when grouping by status.
   *
   * @param {string | null} group - The group value.
   */
  protected addInGroup(group: string | null): void {
    this.taskCreate.open(
      this.rows.groupBy() === 'status' && group !== null
        ? { listId: this.listId(), status: group as StatusKey }
        : { listId: this.listId() },
    );
  }

  /**
   * Method create
   *
   * @description
   * « Ajouter une tâche » of the empty state: creates in this list.
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
   * Method run
   *
   * @description
   * Runs a bulk action on the selection, then reads the rows again in place. The tasks of a
   * refused chunk stay selected and a second toast counts them; a refusal of everything changes
   * nothing and shows the failure toast.
   *
   * @param {BulkAction} action - The action.
   * @param {(count: number) => { title: string; description: string }} toast - The success toast.
   * @param {readonly BulkSelection[]} [selected] - Tasks captured when the action was requested.
   */
  protected async run(
    action: BulkAction,
    toast: (count: number) => { title: string; description: string },
    selected: readonly BulkSelection[] = this.selection(),
  ): Promise<void> {
    if (selected.length === 0 || this.pending()) return;
    const organizationId: string = this.workspace.organization().id;
    this.pending.set(true);
    const outcome: BulkOutcome = await this.store.bulk(selected, action);
    if (this.destroyRef.destroyed) return;
    this.pending.set(false);
    if (this.workspace.organization().id !== organizationId) return;
    this.confirmDelete.set(false);
    if (outcome.notSent.length > 0) {
      this.toasts.warning($localize`:@@spaces.bulk.not-sent:Some selected tasks were not sent.`);
    }
    if (outcome.unknown.length > 0) {
      this.rows.reload();
      this.toasts.warning(
        $localize`:@@spaces.bulk.unknown:The outcome is unknown. The tasks are being refreshed.`,
      );
    }
    if (outcome.done.length === 0 && (outcome.unknown.length > 0 || outcome.notSent.length > 0))
      return;
    if (outcome.done.length === 0) {
      this.toasts.error($localize`:@@spaces.bulk.failed:The selection could not be changed`);
      return;
    }
    const failedKeys: readonly string[] = [
      ...outcome.failed,
      ...outcome.unknown,
      ...outcome.notSent,
    ].map((item: BulkSelection): string => item.taskKey);
    this.tableSelection.set(
      this.rows
        .rows()
        .filter((row: ListRow): boolean => failedKeys.includes(row.task.key))
        .map((row: ListRow): string => row.id),
    );
    const message: { title: string; description: string } = toast(outcome.done.length);
    this.toasts.show(message.title, { description: message.description });
    if (outcome.failed.length > 0) {
      this.toasts.error(bulkPartialText(outcome.failed.length, selected.length), {
        description: $localize`:@@spaces.bulk.partial-text:They stay selected.`,
      });
    }
    this.rows.reload();
  }

  /**
   * Method markDone
   *
   * @description
   * Marks the selection done.
   */
  protected markDone(): void {
    void this.run({ type: 'done' }, (count: number) => ({
      title: bulkDoneText(count),
      description: $localize`:@@spaces.bulk.done-toast-text:Status: Done.`,
    }));
  }

  /**
   * Method assign
   *
   * @description
   * Assigns the selection to a person.
   *
   * @param {string} userId - The person.
   */
  protected assign(userId: string): void {
    const name: string =
      this.bulkPeople().find((person: ViewOption): boolean => person.value === userId)?.label ?? '';
    void this.run({ type: 'assign', userId }, (count: number) => ({
      title: $localize`:@@spaces.bulk.assigned:${name}:name: assigned`,
      description: bulkUpdatedText(count),
    }));
  }

  /**
   * Method move
   *
   * @description
   * Moves the selection to another list.
   *
   * @param {string} listId - The destination.
   */
  protected move(listId: string): void {
    const name: string =
      this.targets().find((target: MoveTarget): boolean => target.listId === listId)?.name ?? '';
    void this.run({ type: 'move', listId }, (count: number) => ({
      title: bulkMovedText(count),
      description: $localize`:@@spaces.bulk.moved-text:To ${name}:name:.`,
    }));
  }

  /**
   * Method trash
   *
   * @description
   * Moves the confirmed selection to the trash.
   */
  protected trash(): void {
    void this.run({ type: 'trash' }, (count: number) => ({
      title: bulkDeletedText(count),
      description: $localize`:@@spaces.bulk.deleted-text:Kept 30 days in the trash.`,
    }));
  }

  /**
   * Method deleteTitle
   *
   * @description
   * Question of the deletion of the selection.
   *
   * @returns {string} The title.
   */
  protected deleteTitle(): string {
    const count: number = this.selection().length;
    return count > 1
      ? $localize`:@@spaces.bulk.delete-title:Delete ${count}:count: tasks?`
      : $localize`:@@spaces.bulk.delete-title-one:Delete this task?`;
  }

  /**
   * Method deleteAction
   *
   * @description
   * Action of the deletion of the selection.
   *
   * @returns {string} The label.
   */
  protected deleteAction(): string {
    const count: number = this.selection().length;
    return count > 1
      ? $localize`:@@spaces.bulk.delete-action:Delete ${count}:count: tasks`
      : $localize`:@@spaces.bulk.delete-action-one:Delete the task`;
  }

  /**
   * Method selectedItems
   *
   * @description
   * Keys of the selected tasks, listed by the confirmation.
   *
   * @returns {readonly string[]} The keys.
   */
  protected selectedItems(): readonly string[] {
    return this.selection().map((item: BulkSelection): string => item.taskKey);
  }
  // #endregion
}
