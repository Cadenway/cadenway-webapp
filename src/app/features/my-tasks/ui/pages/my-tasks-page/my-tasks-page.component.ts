import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import {
  CwEmpty,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwTab, CwTabPanel, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { NgIcon } from '@ng-icons/core';

import {
  type Person,
  TaskCancelDialog,
  TaskCreate,
  TaskMenu,
  type TaskMoveTarget,
  TaskRowActionsStore,
  type TaskRowActionsStoreInstance,
  type TaskSummary,
} from '@features/task';

import type {
  MyTaskRow,
  MyTasksGroup as MyTasksGroupModel,
  MyTasksGroupKey,
} from '../../../models/my-tasks-group/my-tasks-group.interface';
import type {
  MyTasksRead,
  MyTasksTab,
} from '../../../models/my-tasks-read/my-tasks-read.interface';
import { MyTasksStore, type MyTasksStoreInstance } from '../../../state/my-tasks/my-tasks.store';
import { dueBucket, OPEN_BUCKETS } from '../../../utils/due-bucket/due-bucket.util';
import { MyTasksGroup } from '../../components/my-tasks-group/my-tasks-group.component';

/**
 * Constant GROUP_LABELS
 *
 * @description
 * The name of each group (`App.dc.html` lines 6661 and 6665).
 *
 * @type {Readonly<Record<MyTasksGroupKey, string>>}
 */
const GROUP_LABELS: Readonly<Record<MyTasksGroupKey, string>> = {
  late: $localize`:@@my-tasks.group.late:Late`,
  today: $localize`:@@my-tasks.group.today:Today`,
  week: $localize`:@@my-tasks.group.week:Next seven days`,
  later: $localize`:@@my-tasks.group.later:Later`,
  none: $localize`:@@my-tasks.group.none:No due date`,
  closed: $localize`:@@my-tasks.group.closed:Done and cancelled`,
};

/**
 * Constant ARCHIVED_LIST
 *
 * @description
 * The list cell of a task whose list is not in the sidebar although the sidebar holds lists of
 * its space, which it reads with all their live lists: it was archived (gap G-T1, until
 * `TaskSummary` carries its list's name).
 *
 * @type {string}
 */
const ARCHIVED_LIST: string = $localize`:@@my-tasks.row.archived-list:Archived list`;

/**
 * Constant SKELETON_GROUPS
 *
 * @description
 * The skeleton's groups (`SK_PAGES.Mine` of `App.dc.html`, line 4195): three labelled groups of
 * four, three and two lines, each line with the mockup's width of its name.
 *
 * @type {readonly (readonly string[])[]}
 */
const SKELETON_GROUPS: readonly (readonly string[])[] = [
  ['w-2/5', 'w-1/3', 'w-5/12', 'w-4/5'],
  ['w-1/2', 'w-1/3', 'w-5/12'],
  ['w-3/4', 'w-2/3'],
];

/**
 * Component MyTasksPage
 *
 * @description
 * The `My tasks` screen at `/:org/my-tasks` (`App.dc.html` lines 1749-1789): its header with
 * `Create a task` (the create dialog with its defaults: the caller assigned, `To do`), the `To do`
 * and `Done` tabs with their counts (`?tab=closed` selects the second, kept in the address), then,
 * in the selected tab's panel, its groups: on `To do` the late, today, next seven days, later and
 * undated tasks (only non-empty groups, in that order, against the local day of the read), on
 * `Done` one `Done and cancelled` group, read a page at a time with `Show more`. Each line is Task's `cw-task-line`: a click opens the task detail, the context
 * gestures open Task's `cw-task-menu`, whose writes run through the route's `TaskRowActionsStore`
 * with the cancel reason dialog and the deletion confirmation rendered here. The page reads its
 * rows again after each settled write (`changed`); `MyTasksStore` also reads them on focus, on a
 * realtime reconnection, after the detail or the create dialog (gap G-R1: no realtime event covers
 * these tasks). While the tab's first read runs, the header stays (its `h1` is the route focus
 * target) and a skeleton stands for the tabs and the groups (`Loading your tasks`); its failure
 * reaches the route's error boundary through the template's read; a failed later page or refresh
 * shows an inline error with `Retry` above the rows; a successful empty tab shows `Nothing here`.
 */
@Component({
  selector: 'cw-my-tasks-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    CwTab,
    CwTabPanel,
    CwTabs,
    CwTabsList,
    MyTasksGroup,
    NgIcon,
    NgTemplateOutlet,
    TaskCancelDialog,
    TaskMenu,
  ],
  providers: [MyTasksStore],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './my-tasks-page.component.html',
})
export class MyTasksPage {
  // #region Properties
  /**
   * Property tab
   *
   * @description
   * The `tab` query parameter: `closed` selects `Done`, anything else `To do`.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly tab: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property store
   *
   * @description
   * The page's reads.
   *
   * @type {MyTasksStoreInstance}
   * @readonly
   */
  protected readonly store: MyTasksStoreInstance = inject(MyTasksStore);

  /**
   * Property rowActions
   *
   * @description
   * The task menu's writes, provided on the route.
   *
   * @type {TaskRowActionsStoreInstance}
   * @readonly
   */
  protected readonly rowActions: TaskRowActionsStoreInstance = inject(TaskRowActionsStore);

  /**
   * Property groupLabels
   *
   * @description
   * The name of each group.
   *
   * @type {Readonly<Record<MyTasksGroupKey, string>>}
   * @readonly
   */
  protected readonly groupLabels: Readonly<Record<MyTasksGroupKey, string>> = GROUP_LABELS;

  /**
   * Property skeletonGroups
   *
   * @description
   * The skeleton's line widths per group.
   *
   * @type {readonly (readonly string[])[]}
   * @readonly
   */
  protected readonly skeletonGroups: readonly (readonly string[])[] = SKELETON_GROUPS;

  /**
   * Property shownTab
   *
   * @description
   * The selected tab.
   *
   * @type {Signal<MyTasksTab>}
   * @readonly
   */
  protected readonly shownTab: Signal<MyTasksTab> = computed((): MyTasksTab =>
    this.tab() === 'closed' ? 'closed' : 'open',
  );

  /**
   * Property groups
   *
   * @description
   * The tab's non-empty groups, built from the rows as the writes show them (a deleted task is
   * hidden at once). A task stays in the group of its read status and due date until the tab is
   * read again, so a status picked from the menu changes its icon at once and moves it with the
   * next read.
   *
   * @type {Signal<readonly MyTasksGroupModel[]>}
   * @readonly
   */
  protected readonly groups: Signal<readonly MyTasksGroupModel[]> = computed(
    (): readonly MyTasksGroupModel[] => {
      const read: MyTasksRead | undefined = this.store.read();
      if (!read) return [];
      const rows: readonly MyTaskRow[] = this.rowActions
        .rows(read.tasks)
        .map((task: TaskSummary): MyTaskRow => ({
          task,
          status: this.rowActions.displayedStatus(task),
          listName: this.listName(task),
        }));
      if (read.tab === 'closed') return rows.length > 0 ? [{ key: 'closed', rows }] : [];
      return OPEN_BUCKETS.map((key: MyTasksGroupKey): MyTasksGroupModel => ({
        key,
        rows: rows.filter(
          (row: MyTaskRow): boolean => dueBucket(row.task.due, row.task.status, read.today) === key,
        ),
      })).filter((group: MyTasksGroupModel): boolean => group.rows.length > 0);
    },
  );

  /**
   * Property menuKey
   *
   * @description
   * Key of the task whose line opened the menu last.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly menuKey: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuTask
   *
   * @description
   * The task the menu acts on, as the writes show it; null once it left the page.
   *
   * @type {Signal<TaskSummary | null>}
   * @readonly
   */
  protected readonly menuTask: Signal<TaskSummary | null> = computed((): TaskSummary | null => {
    const key: string | null = this.menuKey();
    if (key === null) return null;
    for (const group of this.groups())
      for (const row of group.rows) if (row.task.key === key) return row.task;
    return null;
  });

  /**
   * Property menuTasks
   *
   * @description
   * What the menu acts on: the one task of the line, or nothing.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const task: TaskSummary | null = this.menuTask();
      return task ? [task] : [];
    },
  );

  /**
   * Property menuStatus
   *
   * @description
   * The status the menu checks.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly menuStatus: Signal<StatusKey | null> = computed((): StatusKey | null => {
    const task: TaskSummary | null = this.menuTask();
    return task ? this.rowActions.displayedStatus(task) : null;
  });

  /**
   * Property router
   *
   * @description
   * Changes the tab in the address.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property route
   *
   * @description
   * The page's route, the base of the tab navigation.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property taskCreate
   *
   * @description
   * Opens the create dialog.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the store to the address's tab and the row writes to the read tasks, and reads the rows
   * again after each settled write.
   *
   * @constructor
   */
  public constructor() {
    this.store.show(this.shownTab);
    this.rowActions.sync(this.store.tasks);
    this.rowActions.changed.pipe(takeUntilDestroyed()).subscribe((): void => {
      this.store.refresh();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method selectTab
   *
   * @description
   * Shows a tab: `?tab=closed` for `Done`, no parameter for `To do`, the other parameters kept.
   *
   * @param {string} value - The tab's value.
   */
  protected selectTab(value: string): void {
    const tab: MyTasksTab = value === 'closed' ? 'closed' : 'open';
    if (tab === this.shownTab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'closed' ? 'closed' : null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method create
   *
   * @description
   * `Create a task`: the create dialog with its defaults.
   */
  protected create(): void {
    this.taskCreate.open();
  }

  /**
   * Method openMenu
   *
   * @description
   * Remembers the task of the line that opened the menu, and reads the members again when they
   * could not be read, for `Assign`.
   *
   * @param {TaskSummary} task - The task.
   */
  protected openMenu(task: TaskSummary): void {
    this.menuKey.set(task.key);
    this.store.loadPeople();
  }

  /**
   * Method pickStatus
   *
   * @description
   * `Status` of the menu.
   *
   * @param {StatusKey} status - The status.
   */
  protected pickStatus(status: StatusKey): void {
    const task: TaskSummary | null = this.menuTask();
    if (task) this.rowActions.setStatus(task, status);
  }

  /**
   * Method pickPriority
   *
   * @description
   * `Priority` of the menu.
   *
   * @param {PriorityKey} priority - The priority.
   */
  protected pickPriority(priority: PriorityKey): void {
    const task: TaskSummary | null = this.menuTask();
    if (task) void this.rowActions.setPriority(task, priority);
  }

  /**
   * Method toggleAssignee
   *
   * @description
   * `Assign` of the menu.
   *
   * @param {string} userId - The person toggled.
   */
  protected toggleAssignee(userId: string): void {
    const task: TaskSummary | null = this.menuTask();
    const person: Person | undefined = this.store
      .people()
      .find((candidate: Person): boolean => candidate.id === userId);
    if (task && person) void this.rowActions.toggleAssignee(task, person);
  }

  /**
   * Method move
   *
   * @description
   * `Move to` of the menu.
   *
   * @param {string} listId - The destination list.
   */
  protected move(listId: string): void {
    const task: TaskSummary | null = this.menuTask();
    const target: TaskMoveTarget | undefined = this.store
      .moveTargets()
      .find((list: TaskMoveTarget): boolean => list.listId === listId);
    if (task && target) void this.rowActions.moveTo(task, target);
  }

  /**
   * Method act
   *
   * @description
   * The menu's one-task actions without a value.
   *
   * @param {'remind' | 'duplicate' | 'copyLink' | 'copyKey' | 'delete'} action - The item.
   */
  protected act(action: 'remind' | 'duplicate' | 'copyLink' | 'copyKey' | 'delete'): void {
    const task: TaskSummary | null = this.menuTask();
    if (!task) return;
    switch (action) {
      case 'remind':
        void this.rowActions.remind(task);
        break;
      case 'duplicate':
        void this.rowActions.duplicate(task);
        break;
      case 'copyLink':
        void this.rowActions.copyLink(task);
        break;
      case 'copyKey':
        void this.rowActions.copyKey(task);
        break;
      case 'delete':
        this.rowActions.askDelete(task);
        break;
    }
  }

  /**
   * Method listName
   *
   * @description
   * The list cell of a task: the list's name, `Archived list` when the sidebar holds lists of
   * the task's space but not this one, empty when it holds none of that space (its overview
   * failed or is still read, so a live list may be missing).
   *
   * @param {TaskSummary} task - The task.
   * @returns {string} The cell's text.
   */
  private listName(task: TaskSummary): string {
    const name: string | undefined = this.store.listNames().get(task.listId);
    if (name !== undefined) return name;
    return this.store.listedSpaces().has(task.spaceId) ? ARCHIVED_LIST : '';
  }
  // #endregion
}
